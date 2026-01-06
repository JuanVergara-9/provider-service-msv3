const router = require('express').Router();
const ctrl = require('../controllers/order.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const { injectProvider } = require('../middlewares/provider.middleware');
const { uploadImage } = require('../middlewares/upload.middleware');

// ========== PUBLIC ROUTES (No auth required) ==========
// Recent public orders for social proof feed
router.get('/public/recent', ctrl.getPublicRecent);
// Public stats for Home page
router.get('/stats', ctrl.getStats);

// ========== PROTECTED ROUTES (Auth required) ==========
// Admin: Ver todos los pedidos
router.get('/admin/all', requireAdmin, ctrl.adminGetAll);

// Upload image for order (before creating order)
router.post('/upload-image', requireAuth, uploadImage.single('image'), ctrl.uploadImage);
// Delete image from Cloudinary
router.post('/delete-image', requireAuth, ctrl.deleteImage);

// Publicar un nuevo pedido (solo autenticados)
router.post('/', requireAuth, ctrl.create);

// Ver mis pedidos (como cliente)
router.get('/mine', requireAuth, ctrl.getMine);

// Feed de trabajos para proveedores (requiere ser proveedor)
router.get('/feed', requireAuth, injectProvider, ctrl.getFeed);

// Postularse a un pedido
router.post('/:id/postulate', requireAuth, injectProvider, ctrl.postulate);

// Aceptar una postulación (solo el dueño del pedido)
router.post('/:id/accept', requireAuth, ctrl.acceptPostulation);

// Ver detalle de un pedido
router.get('/:id', requireAuth, ctrl.getById);

module.exports = router;
