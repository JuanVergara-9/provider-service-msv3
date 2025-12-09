const { z } = require('zod');
const svc = require('../services/provider.service');
const { uploadBuffer, destroy } = require('../utils/cloudinary');

const createSchema = z.object({
  category_id: z.number().int().optional(), // legacy
  category_ids: z.array(z.number().int()).min(1).optional(), // new many-to-many
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
  is_licensed: z.boolean().optional(),
  business_hours: z.any().optional()
}).strict();

const updateSchema = createSchema.partial();

// ---- Availability schema (MVP) ----
const rangeSchema = z.object({
  start: z.number().int().min(0).max(1439),
  end: z.number().int().min(1).max(1440)
}).refine(v => v.start < v.end, { message: 'start < end' });

const businessHoursSchema = z.object({
  timezone: z.string().max(64).optional(),
  mon: z.array(rangeSchema).optional(),
  tue: z.array(rangeSchema).optional(),
  wed: z.array(rangeSchema).optional(),
  thu: z.array(rangeSchema).optional(),
  fri: z.array(rangeSchema).optional(),
  sat: z.array(rangeSchema).optional(),
  sun: z.array(rangeSchema).optional()
}).strict();

function normalizeBusinessHours(bh) {
  const base = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
  const src = bh || {};
  const out = { ...base, ...src };
  // ordenar y eliminar solapes simples
  for (const d of Object.keys(base)) {
    if (!Array.isArray(out[d])) { out[d] = []; continue; }
    const sorted = [...out[d]].sort((a, b) => a.start - b.start);
    const merged = [];
    for (const r of sorted) {
      if (!merged.length || r.start > merged[merged.length - 1].end) merged.push({ start: r.start, end: r.end });
      else merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, r.end);
    }
    out[d] = merged;
  }
  return out;
}

const DEFAULT_HOURS = {
  mon: [{ start: 8 * 60, end: 18 * 60 }],
  tue: [{ start: 8 * 60, end: 18 * 60 }],
  wed: [{ start: 8 * 60, end: 18 * 60 }],
  thu: [{ start: 8 * 60, end: 18 * 60 }],
  fri: [{ start: 8 * 60, end: 18 * 60 }],
  sat: [{ start: 9 * 60, end: 13 * 60 }],
  sun: []
};

async function getById(req, res, next) { try { const p = await svc.getById(Number(req.params.id)); res.json({ provider: p }); } catch (e) { next(e); } }
async function getMine(req, res, next) {
  try {
    console.log('[getMine] req.user:', req.user);
    const userId = Number(req.user?.userId);
    console.log('[getMine] userId after Number():', userId, typeof userId);

    if (!userId || isNaN(userId)) {
      console.error('[getMine] Invalid userId:', userId);
      return res.status(401).json({ error: { code: 'PROVIDER.UNAUTHORIZED', message: 'No autorizado: userId inválido' } });
    }

    console.log('[getMine] Calling svc.getMine with userId:', userId);
    const p = await svc.getMine(userId);
    console.log('[getMine] Result from svc.getMine:', p ? 'Found provider' : 'No provider found');
    res.json({ provider: p });
  } catch (e) {
    console.error('[getMine] Error:', e.message);
    next(e);
  }
}

async function createMine(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) {
      return res.status(401).json({ error: { code: 'PROVIDER.UNAUTHORIZED', message: 'No autorizado: userId inválido' } });
    }
    const data = createSchema.parse(req.body);
    const p = await svc.createOrGetMine(userId, data);
    res.status(201).json({ provider: p });
  } catch (e) {
    next(e);
  }
}

async function updateMine(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) {
      return res.status(401).json({ error: { code: 'PROVIDER.UNAUTHORIZED', message: 'No autorizado: userId inválido' } });
    }
    const data = updateSchema.parse(req.body);
    const p = await svc.updateMine(userId, data);
    res.json({ provider: p });
  } catch (e) {
    next(e);
  }
}
async function list(req, res, next) {
  try {
    const licensedParam = (req.query.licensed || '').toString().toLowerCase();
    const isLicensed = licensedParam === 'true' || licensedParam === '1' ? true : undefined;
    const r = await svc.list({
      categorySlug: req.query.category,
      city: req.query.city,
      lat: req.query.lat,
      lng: req.query.lng,
      radiusKm: req.query.radiusKm,
      limit: req.query.limit,
      offset: req.query.offset,
      status: 'active',
      isLicensed
    });
    res.json({ count: r.count, items: r.rows });
  } catch (e) { next(e); }
}

async function uploadAvatar(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) {
      return res.status(401).json({ error: { code: 'PROVIDER.UNAUTHORIZED', message: 'No autorizado: userId inválido' } });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: { code: 'PROVIDER.NO_FILE', message: 'Archivo requerido (field: file)' } });
    }

    const mine = await svc.getMine(userId);
    if (!mine) return res.status(404).json({ error: { code: 'PROVIDER.NOT_FOUND', message: 'Aún no tienes perfil de proveedor' } });

    const folder = process.env.CLOUDINARY_FOLDER || 'miservicio/providers';
    const publicIdBase = `provider_${mine.id}`;
    const uploadResult = await uploadBuffer(req.file.buffer, {
      folder,
      public_id: `${publicIdBase}_${Date.now()}`,
      overwrite: true,
      resource_type: 'image'
    });

    const updated = await svc.setAvatar(userId, {
      url: uploadResult.secure_url || uploadResult.url,
      publicId: uploadResult.public_id,
      version: String(uploadResult.version || '')
    });

    res.status(200).json({ provider: updated });
  } catch (e) { next(e); }
}

async function deleteAvatar(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) {
      return res.status(401).json({ error: { code: 'PROVIDER.UNAUTHORIZED', message: 'No autorizado: userId inválido' } });
    }
    const mine = await svc.getMine(userId);
    if (!mine) return res.status(404).json({ error: { code: 'PROVIDER.NOT_FOUND', message: 'Aún no tienes perfil de proveedor' } });

    if (mine.avatar_public_id) {
      try { await destroy(mine.avatar_public_id); } catch (_e) { /* ignore */ }
    }
    const updated = await svc.clearAvatar(userId);
    res.status(200).json({ provider: updated });
  } catch (e) { next(e); }
}

// ---- Availability endpoints ----
async function getAvailability(req, res, next) {
  try {
    const p = await svc.getById(Number(req.params.id));
    const bh = p.business_hours ? normalizeBusinessHours(p.business_hours) : DEFAULT_HOURS;
    res.json({ availability: { businessHours: bh, emergencyAvailable: !!p.emergency_available } });
  } catch (e) { next(e); }
}

async function getMyAvailability(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) return res.status(401).json({ error: { code: 'PROVIDER.UNAUTHORIZED', message: 'No autorizado' } });
    const p = await svc.getMine(userId);
    if (!p) return res.status(404).json({ error: { code: 'PROVIDER.NOT_FOUND', message: 'Aún no tienes perfil de proveedor' } });
    const bh = p.business_hours ? normalizeBusinessHours(p.business_hours) : DEFAULT_HOURS;
    res.json({ availability: { businessHours: bh, emergencyAvailable: !!p.emergency_available } });
  } catch (e) { next(e); }
}

async function updateMyAvailability(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) return res.status(401).json({ error: { code: 'PROVIDER.UNAUTHORIZED', message: 'No autorizado' } });
    const body = req.body || {};
    const bh = body.businessHours ? businessHoursSchema.parse(body.businessHours) : undefined;
    const emergency = typeof body.emergencyAvailable === 'boolean' ? body.emergencyAvailable : undefined;
    const payload = {};
    if (bh) payload.business_hours = normalizeBusinessHours(bh);
    if (typeof emergency === 'boolean') payload.emergency_available = emergency;
    const updated = await svc.updateMine(userId, payload);
    const out = updated.business_hours ? normalizeBusinessHours(updated.business_hours) : DEFAULT_HOURS;
    res.json({ availability: { businessHours: out, emergencyAvailable: !!updated.emergency_available } });
  } catch (e) { next(e); }
}

async function providerSummary(req, res, next) {
  try {
    const summary = await svc.getProviderSummary();
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function providerUserIds(req, res, next) {
  try {
    const result = await svc.getProviderUserIds();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function checkIsProvider(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ isProvider: false, error: 'Invalid userId' });
    }
    const p = await svc.getMine(userId);
    res.json({ isProvider: !!p });
  } catch (err) {
    next(err);
  }
}

async function uploadIdentityDocs(req, res, next) {
  try {
    const userId = Number(req.user?.userId);
    if (!userId || isNaN(userId)) {
      return res.status(401).json({ error: { code: 'PROVIDER.UNAUTHORIZED', message: 'No autorizado: userId inválido' } });
    }

    const files = req.files || {};
    
    if (!files.dni_front || !files.dni_back || !files.selfie) {
      return res.status(400).json({ error: { code: 'PROVIDER.MISSING_FILES', message: 'Faltan documentos (Frente, Dorso o Selfie)' } });
    }

    const mine = await svc.getMine(userId);
    if (!mine) return res.status(404).json({ error: { code: 'PROVIDER.NOT_FOUND', message: 'Aún no tienes perfil de proveedor' } });

    const uploadToCloud = async (buffer, filename) => {
      return uploadBuffer(buffer, {
        folder: 'miservicio/identity_docs', 
        public_id: `provider_${mine.id}_${filename}_${Date.now()}`,
        resource_type: 'image'
      });
    };

    const [frontRes, backRes, selfieRes] = await Promise.all([
      uploadToCloud(files.dni_front[0].buffer, 'dni_front'),
      uploadToCloud(files.dni_back[0].buffer, 'dni_back'),
      uploadToCloud(files.selfie[0].buffer, 'selfie')
    ]);

    await svc.updateMine(userId, {
      identity_status: 'pending',
      identity_dni_front_url: frontRes.secure_url,
      identity_dni_back_url: backRes.secure_url,
      identity_selfie_url: selfieRes.secure_url,
      identity_rejection_reason: null
    });

    res.json({ message: 'Documentos subidos. Esperando verificación.' });
  } catch (e) {
    next(e);
  }
}

async function adminReviewIdentity(req, res, next) {
  try {
    const providerId = Number(req.params.id);
    const { status, rejection_reason } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: { code: 'PROVIDER.INVALID_STATUS', message: 'Estado inválido' } });
    }

    const provider = await svc.getById(providerId);
    if (!provider) return res.status(404).json({ error: { code: 'PROVIDER.NOT_FOUND', message: 'Proveedor no encontrado' } });

    await provider.update({
      identity_status: status,
      identity_rejection_reason: status === 'rejected' ? rejection_reason : null
    });

    res.json({ provider });
  } catch (e) {
    next(e);
  }
}

async function listForAdmin(req, res, next) {
  try {
    const { identityStatus, limit, offset } = req.query;
    
    const r = await svc.list({
      identityStatus,
      limit,
      offset,
    });
    res.json({ count: r.count, items: r.rows });
  } catch (e) { 
    next(e); 
  }
}

module.exports = {
  getById,
  getMine,
  createMine,
  updateMine,
  list,
  uploadAvatar,
  deleteAvatar,
  getAvailability,
  getMyAvailability,
  updateMyAvailability,
  providerSummary,
  providerUserIds,
  checkIsProvider,
  uploadIdentityDocs,
  adminReviewIdentity,
  listForAdmin
};
