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
  is_licensed: z.boolean().optional(),
  business_hours: z.any().optional()
}).strict();

const updateSchema = createSchema.partial();

async function getById(req, res, next) { try { const p = await svc.getById(Number(req.params.id)); res.json({ provider: p }); } catch (e) { next(e); } }

async function list(req, res, next) {
  try {
    const licensedParam = (req.query.licensed || '').toString().toLowerCase();
    const isLicensed = licensedParam === 'true' || licensedParam === '1' ? true : undefined;
    
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
      isLicensed,
      urgency: req.query.urgency
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
  } catch (e) { next(e); }
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

module.exports = {
  getById,
  getMine,
  createMine,
  updateMine,
  list,
  providerSummary,
  providerUserIds,
  checkIsProvider
};
