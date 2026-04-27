const router = require('express').Router();
const ctrl = require('../controllers/provider.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { uploadImage, uploadImageMultiple } = require('../middlewares/upload.middleware');

const SYNC_STATS_KEY = process.env.SYNC_STATS_API_KEY;
const requireSyncStatsAuth = (req, res, next) => {
  if (SYNC_STATS_KEY && req.headers['x-api-key'] === SYNC_STATS_KEY) return next();
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (token) return requireAuth(req, res, next);
  return res.status(401).json({ success: false, error: 'Unauthorized: x-api-key o Bearer token requerido' });
};

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
router.put('/mine/reputation-consent', requireAuth, ctrl.acceptReputationConsent);

// Availability (edición desde perfil, sin tocar registro)
router.get('/mine/availability', requireAuth, ctrl.getMyAvailability);
router.put('/mine/availability', requireAuth, ctrl.updateMyAvailability);

// Avatar upload/delete
router.post('/mine/avatar', requireAuth, uploadImage.single('file'), ctrl.uploadAvatar);
router.delete('/mine/avatar', requireAuth, ctrl.deleteAvatar);

// Identity verification (trabajador)
router.post('/mine/identity', requireAuth, uploadIdentity, ctrl.uploadIdentityDocs);

// Matrícula / credencial (trabajador) — revisión admin
router.post('/mine/certification', requireAuth, uploadImage.single('file'), ctrl.uploadCertificationDoc);

// Admin routes (IMPORTANTE: Proteger con middleware de rol admin)
router.get('/admin/list', requireAuth, ctrl.listForAdmin);
router.put('/:id/identity-review', requireAuth, ctrl.adminReviewIdentity);
router.put('/:id/certification-review', requireAuth, ctrl.adminReviewCertification);

router.get('/me/profile', requireAuth, ctrl.getMine);
router.post('/me', requireAuth, ctrl.createMine);
router.put('/me', requireAuth, ctrl.updateMine);
router.put('/me/reputation-consent', requireAuth, ctrl.acceptReputationConsent);

// Ruta con parámetro numérico al final para evitar capturar '/mine'
router.get('/:id/availability', ctrl.getAvailability);

// Sincronizar CV Vivo (reseña + ingreso). Interno: x-api-key o JWT Bearer (notification-service)
router.post('/:id/sync-stats', requireSyncStatsAuth, ctrl.syncStats);

// Ruta genérica al final (orden importa)
router.get('/:id', ctrl.getById); // público

module.exports = router;
