const { z } = require('zod');
const svc = require('../services/provider.service');
const { uploadBuffer, destroy } = require('../utils/cloudinary');

const createSchema = z.object({
  category_id: z.number().int(),
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
  business_hours: z.any().optional()
}).strict();

const updateSchema = createSchema.partial();

async function getById(req,res,next){ try{ const p=await svc.getById(Number(req.params.id)); res.json({ provider:p }); } catch(e){ next(e); } }
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
async function list(req,res,next){
  try{
    const r = await svc.list({
      categorySlug: req.query.category,
      city: req.query.city,
      lat: req.query.lat,
      lng: req.query.lng,
      radiusKm: req.query.radiusKm,
      limit: req.query.limit,
      offset: req.query.offset,
      status: 'active'
    });
    res.json({ count: r.count, items: r.rows });
  } catch(e){ next(e); }
}

module.exports = { getById, getMine, createMine, updateMine, list };

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
      try { await destroy(mine.avatar_public_id); } catch(_e) { /* ignore */ }
    }
    const updated = await svc.clearAvatar(userId);
    res.status(200).json({ provider: updated });
  } catch (e) { next(e); }
}

module.exports.uploadAvatar = uploadAvatar;
module.exports.deleteAvatar = deleteAvatar;
