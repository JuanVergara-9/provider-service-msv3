const { Order, Provider, Category, Postulation, Conversation, Message, Sequelize } = require('../../models');
const { appEmitter, EVENTS } = require('../utils/events');
const { getDistanceKm } = require('../utils/geo');
const axios = require('axios');

class OrderService {
    constructor() {
        // Escuchar evento de nuevo pedido
        appEmitter.on(EVENTS.ORDER_CREATED, this._handleOrderCreated.bind(this));
    }

    async _getUserProfiles(userIds, token) {
        if (!userIds || userIds.length === 0) return [];
        try {
            const gatewayUrl = process.env.GATEWAY_URL || process.env.API_GATEWAY_URL || 'http://localhost:4002';
            const userServiceUrl = gatewayUrl.includes('localhost') ? 'http://localhost:4002/api/v1/users' : `${gatewayUrl}/api/v1/users`;
            
            const response = await axios.get(`${userServiceUrl}/batch?ids=${userIds.join(',')}`, {
                headers: { 'Authorization': token },
                timeout: 5000
            });
            
            return response.data.profiles || [];
        } catch (error) {
            console.error('[OrderService._getUserProfiles] Error fetching profiles:', error.message);
            return [];
        }
    }

    async _getUserEmails(userIds, token) {
        if (!userIds || userIds.length === 0) return [];
        try {
            const gatewayUrl = process.env.GATEWAY_URL || process.env.API_GATEWAY_URL || 'http://localhost:4001';
            const authServiceUrl = gatewayUrl.includes('localhost') ? 'http://localhost:4001/api/v1/auth' : `${gatewayUrl}/api/v1/auth`;
            
            const response = await axios.get(`${authServiceUrl}/admin/batch-emails?ids=${userIds.join(',')}`, {
                headers: { 'Authorization': token },
                timeout: 5000
            });
            
            return response.data.emails || [];
        } catch (error) {
            console.error('[OrderService._getUserEmails] Error fetching emails:', error.message);
            return [];
        }
    }

    async createOrder(data) {
        const order = await Order.create({
            user_id: data.user_id,
            category_id: data.category_id,
            title: data.title,
            description: data.description,
            lat: data.lat,
            lng: data.lng,
            images: data.images || [],
            budget_estimate: data.budget_estimate,
            status: 'PENDING'
        });

        // Emitir evento asíncrono para el matching
        appEmitter.emit(EVENTS.ORDER_CREATED, order);

        return order;
    }

    async getOrderById(id) {
        return await Order.findByPk(id, {
            include: [
                { model: Category, as: 'category' },
                { model: Provider, as: 'winner_provider' }
            ]
        });
    }

    /**
     * Worker asíncrono para emparejar pedidos con proveedores
     */
    async _handleOrderCreated(order) {
        console.log(`[MatchingWorker] Processing new order: ${order.id} (${order.title})`);

        try {
            // 1. Buscar proveedores del mismo rubro
            const providers = await Provider.findAll({
                where: {
                    category_id: order.category_id,
                    status: 'active'
                }
            });

            console.log(`[MatchingWorker] Found ${providers.length} potential providers for category ${order.category_id}`);

            const MATCH_RADIUS_KM = 20; // Radio de búsqueda configurable
            const matches = [];

            for (const provider of providers) {
                if (!provider.lat || !provider.lng) continue;

                const distance = getDistanceKm(
                    parseFloat(order.lat), parseFloat(order.lng),
                    parseFloat(provider.lat), parseFloat(provider.lng)
                );

                if (distance <= MATCH_RADIUS_KM) {
                    console.log(`[MatchingWorker] MATCH! Provider ${provider.id} is at ${distance.toFixed(2)} km`);
                    matches.push({
                        provider_id: provider.id,
                        distance
                    });

                    // Aquí se dispararían las notificaciones (Push, Socket, Email)
                    // por ahora solo logueamos el match
                }
            }

            if (matches.length > 0) {
                // Podríamos actualizar el estado a MATCHED si hay interesados directos
                // o simplemente dejarlo en PENDING hasta que alguien postule.
                console.log(`[MatchingWorker] Order ${order.id} matched with ${matches.length} providers.`);
            } else {
                console.log(`[MatchingWorker] No providers found in radius for order ${order.id}.`);
            }

        } catch (error) {
            console.error(`[MatchingWorker] Error during matching for order ${order.id}:`, error);
        }
    }

    async getAvailableJobs(provider) {
        const EXPIRE_TIME_HS = 72;
        const expirationLimit = new Date();
        expirationLimit.setHours(expirationLimit.getHours() - EXPIRE_TIME_HS);

        // Buscar pedidos de la categoría del proveedor dentro de un radio razonable
        // Esto es lo que alimentará el feed del profesional
        const orders = await Order.findAll({
            where: {
                category_id: provider.category_id,
                status: 'PENDING',
                created_at: {
                    [Sequelize.Op.gt]: expirationLimit
                }
            },
            order: [['created_at', 'DESC']]
        });

        // Filtrar por distancia manualmente
        return orders.filter(order => {
            const distance = getDistanceKm(
                parseFloat(order.lat), parseFloat(order.lng),
                parseFloat(provider.lat), parseFloat(provider.lng)
            );
            return distance <= 50;
        });
    }

    /**
     * Get the most recent public orders (anonymized) for the social proof feed.
     * Returns orders from the last 24h with minimal info.
     */
    async getPublicRecentOrders(limit = 5) {
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const orders = await Order.findAll({
            where: {
                status: { [Sequelize.Op.in]: ['PENDING', 'MATCHED', 'IN_PROGRESS', 'COMPLETED'] },
                created_at: { [Sequelize.Op.gt]: twentyFourHoursAgo }
            },
            include: [{ model: Category, as: 'category' }],
            order: [['created_at', 'DESC']],
            limit
        });

        // Anonymize: return only category and rough location
        return orders.map(o => ({
            id: o.id,
            category_name: o.category?.name || 'Servicio',
            // TODO: Could reverse-geocode to get neighborhood/zone
            created_at: o.created_at
        }));
    }

    /**
     * Get public statistics for the Home page.
     */
    async getStats() {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const [resolvedThisMonth, totalOrders] = await Promise.all([
            Order.count({
                where: {
                    status: { [Sequelize.Op.in]: ['COMPLETED', 'IN_PROGRESS'] },
                    created_at: { [Sequelize.Op.gte]: startOfMonth }
                }
            }),
            Order.count()
        ]);

        return {
            resolved_this_month: resolvedThisMonth,
            total_orders: totalOrders
        };
    }

    async getClientOrders(userId) {
        const { Postulation, Provider, Category, Conversation } = require('../../models');
        const orders = await Order.findAll({
            where: { user_id: userId },
            include: [
                { model: Category, as: 'category' },
                {
                    model: Postulation,
                    as: 'postulations',
                    include: [{ model: Provider, as: 'provider' }]
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Para cada orden, buscar si existen conversaciones asociadas a los proveedores postulados
        const ordersWithConv = await Promise.all(orders.map(async (order) => {
            const orderJson = order.toJSON();
            if (orderJson.postulations) {
                orderJson.postulations = await Promise.all(orderJson.postulations.map(async (p) => {
                    // Primero buscar la conversación específica de este pedido
                    let conv = await Conversation.findOne({
                        where: {
                            clientId: userId,
                            providerId: p.provider_id,
                            serviceId: order.id
                        },
                        attributes: ['id']
                    });

                    // Si no existe, buscar cualquier conversación previa entre ellos
                    if (!conv) {
                        conv = await Conversation.findOne({
                            where: {
                                clientId: userId,
                                providerId: p.provider_id
                            },
                            attributes: ['id'],
                            order: [['updatedAt', 'DESC']]
                        });
                    }
                    
                    return { ...p, conversationId: conv ? conv.id : null };
                }));
            }
            return orderJson;
        }));

        return ordersWithConv;
    }

    async adminGetAllOrders(params = {}, token) {
        const { limit = 50, offset = 0, status } = params;
        const where = {};
        if (status) where.status = status;

        const { count, rows } = await Order.findAndCountAll({
            where,
            include: [
                { model: Category, as: 'category' },
                { model: Provider, as: 'winner_provider' }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Fetch user profiles for the orders
        const userIds = [...new Set(rows.map(o => o.user_id))];
        const [profiles, emails] = await Promise.all([
            this._getUserProfiles(userIds, token),
            this._getUserEmails(userIds, token)
        ]);

        const profileMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = p;
            return acc;
        }, {});

        const emailMap = emails.reduce((acc, u) => {
            acc[u.id] = u.email;
            return acc;
        }, {});

        // Fallback: Fetch provider info for these userIds in case they are providers but don't have a user profile name
        // This is common in development or if they only filled their professional profile
        const providersAsClients = await Provider.findAll({
            where: { user_id: { [Sequelize.Op.in]: userIds } },
            attributes: ['user_id', 'first_name', 'last_name', 'avatar_url']
        });
        const providerMap = providersAsClients.reduce((acc, p) => {
            acc[p.user_id] = p;
            return acc;
        }, {});

        const ordersWithUsers = rows.map(o => {
            const json = o.toJSON();
            const profile = profileMap[json.user_id];
            const provider = providerMap[json.user_id];
            const email = emailMap[json.user_id];
            
            if (profile && (profile.first_name || profile.last_name)) {
                json.user_name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
                json.user_avatar = profile.avatar_url;
            } else if (provider) {
                // Use provider info as fallback
                json.user_name = `${provider.first_name || ''} ${provider.last_name || ''}`.trim();
                json.user_avatar = provider.avatar_url;
            } else if (email) {
                // Use email prefix as fallback if no name is found
                json.user_name = email.split('@')[0];
            } else {
                json.user_name = 'Usuario';
            }

            // Final fallback if name ended up empty after trim
            if (!json.user_name || json.user_name.trim() === '') {
                json.user_name = email ? email.split('@')[0] : 'Usuario';
            }

            return json;
        });

        return { total: count, orders: ordersWithUsers };
    }

    async acceptPostulation(orderId, postulationId, clientId) {
        const orderIdNum = Number(orderId);
        const { getIo } = require('../socket');

        // 1. Validar que la orden exista
        const order = await Order.findByPk(orderIdNum);
        if (!order) throw new Error('Order not found');
        if (order.user_id !== clientId) throw new Error('Unauthorized');

        // Idempotencia: Si ya está aceptada y el ganador es el mismo, devolver éxito silencioso
        if (order.status === 'IN_PROGRESS' && order.winner_provider_id) {
            const existingConv = await Conversation.findOne({
                where: { clientId, providerId: order.winner_provider_id, serviceId: orderIdNum }
            });
            return { success: true, order, conversationId: existingConv?.id };
        }

        if (order.status !== 'PENDING' && order.status !== 'MATCHED') {
            throw new Error('Order is not in a valid state to be accepted');
        }

        const winnerPostulation = await Postulation.findByPk(postulationId, {
            include: [{ model: Provider, as: 'provider' }]
        });
        if (!winnerPostulation || winnerPostulation.order_id !== orderIdNum) {
            throw new Error('Invalid postulation');
        }

        // 2. Marcar ganador, guardar precio acordado (Shadow Ledger / GMV) y cerrar orden
        const updatePayload = {
            winner_provider_id: winnerPostulation.provider_id,
            status: 'IN_PROGRESS'
        };
        if (winnerPostulation.budget != null && winnerPostulation.budget !== '') {
            updatePayload.final_agreed_price = winnerPostulation.budget;
        }
        await order.update(updatePayload);

        // 3. Aceptar postulación ganadora
        await winnerPostulation.update({ status: 'ACCEPTED' });

        // 4. Rechazar automáticamente el resto
        await Postulation.update(
            { status: 'REJECTED' },
            {
                where: {
                    order_id: orderIdNum,
                    id: { [Sequelize.Op.ne]: postulationId }
                }
            }
        );

        // 5. Crear o buscar conversación entre cliente y profesional
        let [conversation] = await Conversation.findOrCreate({
            where: {
                clientId: clientId,
                providerId: winnerPostulation.provider_id,
                serviceId: orderIdNum // Asociar a este pedido específico
            },
            defaults: {
                clientId: clientId,
                providerId: winnerPostulation.provider_id,
                serviceId: orderIdNum
            }
        });

        // 6. Enviar mensaje automático de sistema
        const systemMessage = await Message.create({
            conversationId: conversation.id,
            senderId: clientId, // El mensaje aparece como si lo iniciara el cliente o sistema
            content: `¡Hola! He aceptado tu postulación para el pedido: "${order.title}". Hablemos por aquí para coordinar los detalles.`,
            isRead: false,
            deliveryStatus: 'sent'
        });

        // 7. Notificar al proveedor vía Socket (si está conectado)
        const io = getIo();
        if (io && winnerPostulation.provider) {
            const providerUserId = winnerPostulation.provider.user_id;
            io.to(`user_${providerUserId}`).emit('postulation_accepted', {
                orderId: order.id,
                orderTitle: order.title,
                conversationId: conversation.id,
                message: systemMessage
            });
        }

        return { success: true, order, conversationId: conversation.id };
    }
}

module.exports = new OrderService();
