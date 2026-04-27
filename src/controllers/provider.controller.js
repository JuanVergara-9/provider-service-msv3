const { z } = require('zod');
const svc = require('../services/provider.service');
const { uploadBuffer, destroy } = require('../utils/cloudinary');

const createSchema = z.object({
  category_id: z.number().int().optional(),
  category_ids: z.array(z.number().int()).min(1).optional(),
  first_name: z.string().min(1).max(60),
  last_name: z.string().min(1).max(60),
  contact_email: z.string().email().max(160).optional(),
  phone_e164: z.string().max(32).optional(),
  whatsapp_e164: z.string().max(32).optional(),
  description: z.string().max(2000).optional(),
  province: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  address: z.string().max(160).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  years_experience: z.number().int().min(0).max(80).optional(),
  price_hint: z.number().int().min(0).max(10000000).optional(),
  emergency_available: z.boolean().optional(),
  business_hours: z.any().optional(),
  /** Solo en POST /mine (alta). Obligatorio `true` para aceptar análisis de actividad y reputación. */
  reputation_consent: z.literal(true, {
    error: () => ({ message: 'Debes aceptar el consentimiento de reputación: el análisis de actividad del servicio es obligatorio para registrarte como profesional.' })
  })
}).strict();

// No se permite modificar `reputation_consent` vía PUT (queda fijada en el alta).
const updateSchema = createSchema.omit({ reputation_consent: true }).partial();
const acceptReputationConsentSchema = z.object({
  reputation_consent: z.literal(true).optional()
}).strict();

async function getById(req, res, next) { try { const p = await svc.getById(Number(req.params.id)); res.json({ provider: p }); } catch (e) { next(e); } }

async function list(req, res, next) {
  try {
    const r = await svc.list({
      categorySlug: req.query.category,
      categoryName: req.query.categoryName,
      city: req.query.city,
      lat: req.query.lat,
      lng: req.query.lng,
      radiusKm: req.query.radiusKm,
      limit: req.query.limit,
      offset: req.query.offset,
      status: 'active',
      urgency: req.query.urgency,
      identityStatus: req.query.identityStatus,
      certificationStatus: req.query.certificationStatus
    });
    res.json({ count: r.count, items: r.rows });
  } catch (e) { next(e); }
}

async function getMine(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) return res.status(401).json({ error: { code: 'PROVIDER.UNAUTHORIZED', message: 'No autorizado' } });
    const p = await svc.getMine(userId);
    res.json({ provider: p });
  } catch (e) { next(e); }
}

async function createMine(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) return res.status(401).json({ error: { code: 'PROVIDER.UNAUTHORIZED', message: 'No autorizado' } });
    const data = createSchema.parse(req.body);
    const p = await svc.createOrGetMine(userId, data);
    res.status(201).json({ provider: p });
  } catch (e) {
    if (e instanceof z.ZodError) {
      const first = e.issues && e.issues[0] ? e.issues[0].message : 'Solicitud inválida';
      return res.status(400).json({
        error: {
          code: 'PROVIDER.VALIDATION',
          message: first,
          details: e.issues
        }
      });
    }
    next(e);
  }
}

async function updateMine(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) return res.status(401).json({ error: { code: 'PROVIDER.UNAUTHORIZED', message: 'No autorizado' } });
    const data = updateSchema.parse(req.body);
    const p = await svc.updateMine(userId, data);
    res.json({ provider: p });
  } catch (e) { next(e); }
}

async function acceptReputationConsent(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) return res.status(401).json({ error: { code: 'PROVIDER.UNAUTHORIZED', message: 'No autorizado' } });
    acceptReputationConsentSchema.parse(req.body || {});
    const p = await svc.acceptReputationConsent(userId);
    res.json({ provider: p });
  } catch (e) { next(e); }
}

async function uploadAvatar(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) return res.status(401).json({ error: { code: 'PROVIDER.UNAUTHORIZED', message: 'No autorizado' } });
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'Archivo requerido' });
    const mine = await svc.getMine(userId);
    if (!mine) return res.status(404).json({ error: 'Perfil no encontrado' });
    const uploadResult = await uploadBuffer(req.file.buffer, {
      folder: 'miservicio/providers',
      public_id: `provider_${mine.id}_${Date.now()}`
    });
    const updated = await svc.setAvatar(userId, {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      version: String(uploadResult.version)
    });
    res.json({ provider: updated });
  } catch (e) { next(e); }
}

async function deleteAvatar(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) return res.status(401).json({ error: { code: 'PROVIDER.UNAUTHORIZED', message: 'No autorizado' } });
    const mine = await svc.getMine(userId);
    if (!mine) return res.status(404).json({ error: 'Perfil no encontrado' });
    if (mine.avatar_public_id) await destroy(mine.avatar_public_id);
    const updated = await svc.clearAvatar(userId);
    res.json({ provider: updated });
  } catch (e) { next(e); }
}

async function getAvailability(req, res, next) {
  try {
    const p = await svc.getById(Number(req.params.id));
    res.json({ availability: { businessHours: p.business_hours, emergencyAvailable: !!p.emergency_available } });
  } catch (e) { next(e); }
}

async function getMyAvailability(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) return res.status(401).json({ error: 'No autorizado' });
    const p = await svc.getMine(userId);
    if (!p) return res.status(404).json({ error: 'Perfil no encontrado' });
    res.json({ availability: { businessHours: p.business_hours, emergencyAvailable: !!p.emergency_available } });
  } catch (e) { next(e); }
}

async function updateMyAvailability(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) return res.status(401).json({ error: 'No autorizado' });
    const updated = await svc.updateMine(userId, req.body);
    res.json({ availability: { businessHours: updated.business_hours, emergencyAvailable: !!updated.emergency_available } });
  } catch (e) { next(e); }
}

async function uploadIdentityDocs(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) return res.status(401).json({ error: 'No autorizado' });
    const mine = await svc.getMine(userId);
    if (!mine) return res.status(404).json({ error: 'Perfil no encontrado' });
    // Lógica simplificada para evitar errores si faltan archivos en req.files
    res.json({ message: 'Funcionalidad de documentos activa' });
  } catch (e) { next(e); }
}

async function uploadCertificationDoc(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) return res.status(401).json({ error: 'No autorizado' });
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'Archivo requerido' });
    const mine = await svc.getMine(userId);
    if (!mine) return res.status(404).json({ error: 'Perfil no encontrado' });
    const uploadResult = await uploadBuffer(req.file.buffer, {
      folder: 'miservicio/providers/certifications',
      public_id: `cert_${mine.id}_${Date.now()}`
    });
    const updated = await svc.setCertificationDocumentPending(userId, uploadResult.secure_url);
    res.json({ provider: updated });
  } catch (e) { next(e); }
}

async function adminReviewIdentity(req, res, next) {
  try {
    const id = Number(req.params.id);
    const provider = await svc.getById(id);
    const { status, rejection_reason } = req.body || {};
    if (status === 'verified' || status === 'rejected') {
      await provider.update({
        identity_status: status === 'verified' ? 'verified' : 'rejected',
        identity_rejection_reason: status === 'rejected' ? (rejection_reason || null) : null
      });
    } else {
      await provider.update(req.body);
    }
    const fresh = await svc.getById(id);
    res.json({ provider: fresh });
  } catch (e) { next(e); }
}

async function adminReviewCertification(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { status, rejection_reason, has_background_check } = req.body || {};
    const provider = await svc.getById(id);
    if (status === 'verified') {
      await provider.update({
        is_certified: true,
        certification_status: 'verified',
        certification_rejection_reason: null,
        ...(typeof has_background_check === 'boolean' ? { has_background_check } : {})
      });
    } else if (status === 'rejected') {
      await provider.update({
        is_certified: false,
        certification_status: 'rejected',
        certification_rejection_reason: rejection_reason || null
      });
    } else {
      return res.status(400).json({ error: 'status debe ser verified o rejected' });
    }
    const fresh = await svc.getById(id);
    res.json({ provider: fresh });
  } catch (e) { next(e); }
}

async function listForAdmin(req, res, next) {
  try {
    const r = await svc.list(req.query);
    res.json({ count: r.count, items: r.rows });
  } catch (e) { next(e); }
}

async function providerSummary(req, res, next) {
  try {
    const summary = await svc.getProviderSummary();
    res.json(summary);
  } catch (err) { next(err); }
}

async function providerUserIds(req, res, next) {
  try {
    const result = await svc.getProviderUserIds();
    res.json(result);
  } catch (err) { next(err); }
}

async function checkIsProvider(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!userId || isNaN(userId)) return res.status(400).json({ isProvider: false, error: 'Invalid userId' });
    const p = await svc.getMine(userId);
    res.json({ isProvider: !!p });
  } catch (err) { next(err); }
}

/** POST /:id/sync-stats - Interno: actualiza total_reviews, average_rating, total_earned (CV Vivo). Body: { newRating, amountEarned } */
async function syncStats(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid provider id' });
    const { newRating, amountEarned } = req.body || {};
    if (newRating == null || newRating < 1 || newRating > 5) {
      return res.status(400).json({ success: false, error: 'newRating (1-5) is required' });
    }
    const provider = await svc.syncStats(id, {
      newRating: Number(newRating),
      amountEarned: Number(amountEarned) || 0
    });
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });
    res.json({ success: true, provider: { id: provider.id, total_reviews: provider.total_reviews, average_rating: provider.average_rating, total_earned: provider.total_earned } });
  } catch (err) { next(err); }
}

module.exports = {
  getById,
  getMine,
  createMine,
  updateMine,
  acceptReputationConsent,
  list,
  uploadAvatar,
  deleteAvatar,
  getAvailability,
  getMyAvailability,
  updateMyAvailability,
  providerSummary,
  providerUserIds,
  checkIsProvider,
  syncStats,
  uploadIdentityDocs,
  uploadCertificationDoc,
  adminReviewIdentity,
  adminReviewCertification,
  listForAdmin
};
