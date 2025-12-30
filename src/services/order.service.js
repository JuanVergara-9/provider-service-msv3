const { Order, Provider, Category, Postulation, Conversation, Message, Sequelize } = require('../../models');
const { appEmitter, EVENTS } = require('../utils/events');
const { getDistanceKm } = require('../utils/geo');

class OrderService {
    constructor() {
        // Escuchar evento de nuevo pedido
        appEmitter.on(EVENTS.ORDER_CREATED, this._handleOrderCreated.bind(this));
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

    async acceptPostulation(orderId, postulationId, clientId) {
        const { Postulation, Provider, Category, Conversation, Message } = require('../../models');
        const { getIo } = require('../socket');

        // 1. Validar que la orden pertenezca al cliente
        const order = await Order.findByPk(orderId);
        if (!order) throw new Error('Order not found');
        if (order.user_id !== clientId) throw new Error('Unauthorized');
        if (order.status !== 'PENDING' && order.status !== 'MATCHED') {
            throw new Error('Order is not in a valid state to be accepted');
        }

        const winnerPostulation = await Postulation.findByPk(postulationId, {
            include: [{ model: Provider, as: 'provider' }]
        });
        if (!winnerPostulation || winnerPostulation.order_id !== parseInt(orderId)) {
            throw new Error('Invalid postulation');
        }

        // 2. Marcar ganador y cerrar orden
        await order.update({
            winner_provider_id: winnerPostulation.provider_id,
            status: 'IN_PROGRESS'
        });

        // 3. Aceptar postulación ganadora
        await winnerPostulation.update({ status: 'ACCEPTED' });

        // 4. Rechazar automáticamente el resto
        await Postulation.update(
            { status: 'REJECTED' },
            {
                where: {
                    order_id: orderId,
                    id: { [Sequelize.Op.ne]: postulationId }
                }
            }
        );

        // 5. Crear o buscar conversación entre cliente y profesional
        let [conversation] = await Conversation.findOrCreate({
            where: {
                clientId: clientId,
                providerId: winnerPostulation.provider_id,
                serviceId: orderId // Asociar a este pedido específico
            },
            defaults: {
                clientId: clientId,
                providerId: winnerPostulation.provider_id,
                serviceId: orderId
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
