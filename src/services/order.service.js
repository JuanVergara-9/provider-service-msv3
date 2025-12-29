const { Order, Provider, Category, Postulation } = require('../../models');
const { Op } = require('sequelize');
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
                    [Op.gt]: expirationLimit
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
                status: { [Op.in]: ['PENDING', 'MATCHED', 'IN_PROGRESS', 'COMPLETED'] },
                created_at: { [Op.gt]: twentyFourHoursAgo }
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
                    status: { [Op.in]: ['COMPLETED', 'IN_PROGRESS'] },
                    created_at: { [Op.gte]: startOfMonth }
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
        const { Postulation, Provider, Category } = require('../../models');
        return await Order.findAll({
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
    }

    async acceptPostulation(orderId, postulationId, clientId) {
        // 1. Validar que la orden pertenezca al cliente
        const order = await Order.findByPk(orderId);
        if (!order) throw new Error('Order not found');
        if (order.user_id !== clientId) throw new Error('Unauthorized');
        if (order.status !== 'PENDING' && order.status !== 'MATCHED') {
            throw new Error('Order is not in a valid state to be accepted');
        }

        const winnerPostulation = await Postulation.findByPk(postulationId);
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
                    id: { [Op.ne]: postulationId }
                }
            }
        );

        return { success: true, order };
    }
}

module.exports = new OrderService();
