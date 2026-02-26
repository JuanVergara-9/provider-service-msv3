const router = require('express').Router();
const ctrl = require('../controllers/provider.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { uploadImage, uploadImageMultiple } = require('../middlewares/upload.middleware');

// Listado público (GET /api/v1/providers o /api/v1/providers/). '' por si el path llega vacío.
router.get('/', ctrl.list);
router.get('', ctrl.list);
router.get('/stats/summary', ctrl.providerSummary);
router.get('/user-ids', ctrl.providerUserIds);
router.get('/check/:userId', ctrl.checkIsProvider);

const uploadIdentity = uploadImageMultiple.fields([
  { name: 'dni_front', maxCount: 1 },
  { name: 'dni_back', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]);
// Rutas específicas deben ir ANTES de rutas genéricas con parámetros
router.get('/mine', requireAuth, ctrl.getMine); // alias para compatibilidad con el frontend
router.post('/mine', requireAuth, ctrl.createMine);
router.put('/mine', requireAuth, ctrl.updateMine);

// Availability (edición desde perfil, sin tocar registro)
router.get('/mine/availability', requireAuth, ctrl.getMyAvailability);
router.put('/mine/availability', requireAuth, ctrl.updateMyAvailability);

// Avatar upload/delete
router.post('/mine/avatar', requireAuth, uploadImage.single('file'), ctrl.uploadAvatar);
router.delete('/mine/avatar', requireAuth, ctrl.deleteAvatar);

// Identity verification (trabajador)
router.post('/mine/identity', requireAuth, uploadIdentity, ctrl.uploadIdentityDocs);

// Admin routes (IMPORTANTE: Proteger con middleware de rol admin)
router.get('/admin/list', requireAuth, ctrl.listForAdmin);
router.put('/:id/identity-review', requireAuth, ctrl.adminReviewIdentity);

router.get('/me/profile', requireAuth, ctrl.getMine);
router.post('/me', requireAuth, ctrl.createMine);
router.put('/me', requireAuth, ctrl.updateMine);

// Ruta con parámetro numérico al final para evitar capturar '/mine'
// Consultar disponibilidad pública por id
router.get('/:id/availability', ctrl.getAvailability);

// Ruta genérica al final (orden importa). Evita capturar '/mine' por estar antes.
router.get('/:id', ctrl.getById); // público

module.exports = router;
