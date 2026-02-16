const orderService = require('../services/order.service');

class OrderController {
    /**
     * GET /orders/public/recent - Public endpoint (no auth needed)
     * Returns recent anonymized orders for the social proof feed.
     */
    async getPublicRecent(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 5;
            const orders = await orderService.getPublicRecentOrders(limit);
            res.json({ orders });
        } catch (error) {
            console.error('Error fetching public recent orders:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * GET /orders/stats - Public endpoint (no auth needed)
     * Returns public statistics (resolved orders this month, etc).
     */
    async getStats(req, res) {
        try {
            const stats = await orderService.getStats();
            res.json(stats);
        } catch (error) {
            console.error('Error fetching order stats:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async create(req, res) {
        try {
            const { title, description, category_id, lat, lng, images, budget_estimate } = req.body;
            const user_id = req.user?.id; // Suponiendo que el middleware de auth inyecta el user

            if (!lat || !lng) {
                return res.status(400).json({ error: 'Exact location (lat, lng) is required.' });
            }

            const order = await orderService.createOrder({
                user_id,
                category_id,
                title,
                description,
                lat,
                lng,
                images,
                budget_estimate
            });

            res.status(201).json(order);
        } catch (error) {
            console.error('Error creating order:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getFeed(req, res) {
        try {
            const provider = req.provider; // Suponiendo middleware que identifica al proveedor
            if (!provider) {
                return res.status(403).json({ error: 'Only providers can access the job feed.' });
            }

            const jobs = await orderService.getAvailableJobs(provider);
            res.json(jobs);
        } catch (error) {
            console.error('Error fetching jobs feed:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getById(req, res) {
        try {
            const order = await orderService.getOrderById(req.params.id);
            if (!order) return res.status(404).json({ error: 'Order not found' });
            res.json(order);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async postulate(req, res) {
        try {
            const { id } = req.params;
            const { message, budget } = req.body;
            const provider = req.provider;

            if (!provider) {
                return res.status(403).json({ error: 'Only registered providers can postulate to jobs.' });
            }

            const { Postulation, Order: OrderModel } = require('../../models');

            // 1. Validar límite de 3 postulaciones activas (SENT)
            const activePostulationsCount = await Postulation.count({
                where: { provider_id: provider.id, status: 'SENT' }
            });

            if (activePostulationsCount >= 3) {
                return res.status(403).json({
                    error: 'Limit reached.',
                    message: 'Ya tenés 3 postulaciones activas. Debes esperar a que los clientes respondan o que los pedidos expiren.'
                });
            }

            // 2. Validar si ya postuló a ESTE pedido específico
            const existing = await Postulation.findOne({
                where: { order_id: id, provider_id: provider.id }
            });

            if (existing) {
                return res.status(400).json({ error: 'You have already postulated to this job.' });
            }

            const postulation = await Postulation.create({
                order_id: id,
                provider_id: provider.id,
                message,
                budget,
                status: 'SENT'
            });

            // Actualizar estado del pedido si es necesario
            await OrderModel.update({ status: 'MATCHED' }, { where: { id, status: 'PENDING' } });

            res.status(201).json(postulation);
        } catch (error) {
            console.error('Error in postulation:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async acceptPostulation(req, res) {
        try {
            const { id: orderId } = req.params;
            const { postulation_id } = req.body;
            const clientId = req.user.id;

            const result = await orderService.acceptPostulation(orderId, postulation_id, clientId);
            res.json(result);
        } catch (error) {
            console.error('Error accepting postulation:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async getMine(req, res) {
        try {
            const userId = req.user.id;
            const orders = await orderService.getClientOrders(userId);
            res.json(orders);
        } catch (error) {
            console.error('Error fetching client orders:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async adminGetAll(req, res) {
        try {
            const { limit, offset, status } = req.query;
            const token = req.headers.authorization;
            const result = await orderService.adminGetAllOrders({ limit, offset, status }, token);
            res.json(result);
        } catch (error) {
            console.error('Error in adminGetAllOrders:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async uploadImage(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No image file provided' });
            }

            const { uploadBuffer } = require('../utils/cloudinary');
            const folder = process.env.CLOUDINARY_FOLDER || 'miservicio/orders';

            const result = await uploadBuffer(req.file.buffer, {
                folder,
                transformation: [
                    { width: 1200, height: 1200, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' }
                ]
            });

            res.json({
                url: result.secure_url,
                public_id: result.public_id
            });
        } catch (error) {
            console.error('Error uploading order image:', error);
            res.status(500).json({ error: 'Failed to upload image' });
        }
    }

    async deleteImage(req, res) {
        try {
            const { public_id } = req.body;

            if (!public_id) {
                return res.status(400).json({ error: 'public_id is required' });
            }

            const { destroy } = require('../utils/cloudinary');
            await destroy(public_id);

            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting image:', error);
            res.status(500).json({ error: 'Failed to delete image' });
        }
    }

    /**
     * POST /api/v1/orders/match - Shadow Ledger: cierra match requestId + workerId.
     * Input: { requestId, workerId }. NO recibe precio desde frontend (se toma de la postulación).
     * Output: { success: true, whatsappLink }.
     */
    async match(req, res) {
        try {
            const { requestId, workerId } = req.body;
            if (!requestId || !workerId) {
                return res.status(400).json({ error: 'requestId and workerId are required' });
            }
            const result = await orderService.matchFromRequest(Number(requestId), Number(workerId));
            res.json(result);
        } catch (error) {
            console.error('Error in orders/match:', error);
            const status = /not found|no longer open|No postulation/i.test(error.message) ? 404 : 400;
            res.status(status).json({ error: error.message || 'Match failed' });
        }
    }
}

module.exports = new OrderController();
