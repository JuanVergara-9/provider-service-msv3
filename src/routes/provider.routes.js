const router = require('express').Router();
const ctrl = require('../controllers/provider.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { uploadImage } = require('../middlewares/upload.middleware');

router.get('/', ctrl.list); // público (listado con filtros)
router.get('/stats/summary', ctrl.providerSummary); // Resumen de proveedores (total, activos)
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

router.get('/me/profile', requireAuth, ctrl.getMine);
router.post('/me', requireAuth, ctrl.createMine);
router.put('/me', requireAuth, ctrl.updateMine);

// Ruta con parámetro numérico al final para evitar capturar '/mine'
// Consultar disponibilidad pública por id
router.get('/:id/availability', ctrl.getAvailability);

// Ruta genérica al final (orden importa). Evita capturar '/mine' por estar antes.
router.get('/:id', ctrl.getById); // público

module.exports = router;
