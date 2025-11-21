const { Provider, Category } = require('../../models');
const { conflict, notFound } = require('../utils/httpError');
const { Op, Sequelize } = require('sequelize');

async function getById(id) {
  const p = await Provider.findByPk(id, {
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'icon'] },
      { model: Category, as: 'categories', attributes: ['id', 'name', 'slug', 'icon'] }
    ]
  });
  if (!p) throw notFound('PROVIDER.NOT_FOUND', 'Proveedor no encontrado');
  return p;
}

async function getMine(userId) {
  console.log('[getMine] Searching for provider with userId:', userId, typeof userId);

  // Validar que userId es un número válido
  if (!userId || isNaN(userId) || userId <= 0) {
    console.error('[getMine] Invalid userId in service:', userId);
    throw new Error('Invalid userId provided to getMine service');
  }

  const query = {
    where: { user_id: userId },
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'icon'] },
      { model: Category, as: 'categories', attributes: ['id', 'name', 'slug', 'icon'] }
    ]
  };

  console.log('[getMine] Sequelize query:', JSON.stringify(query, null, 2));

  try {
    const result = await Provider.findOne(query);
    console.log('[getMine] Query result:', result ? 'Provider found' : 'No provider found');
    return result;
  } catch (error) {
    console.error('[getMine] Database error:', error.message);
    throw error;
  }
}

async function createOrGetMine(userId, payload) {
  const existing = await getMine(userId);
  if (existing) return existing; // idempotente

  // valida existencia de categoría
  // Accept either category_id (legacy) or category_ids (new)
  let categoryIds = [];
  if (Array.isArray(payload.category_ids) && payload.category_ids.length > 0) {
    categoryIds = payload.category_ids;
  } else if (payload.category_id) {
    categoryIds = [payload.category_id];
  }
  if (categoryIds.length === 0) {
    throw notFound('CATEGORY.REQUIRED', 'Al menos una categoría es requerida');
  }
  const found = await Category.findAll({ where: { id: { [Op.in]: categoryIds } } });
  if (found.length !== categoryIds.length) throw notFound('CATEGORY.NOT_FOUND', 'Una o más categorías inexistentes');

  const provider = await Provider.create({
    user_id: userId,
    category_id: categoryIds[0], // keep primary for legacy filters
    first_name: payload.first_name,
    last_name: payload.last_name,
    contact_email: payload.contact_email,
    phone_e164: payload.phone_e164,
    whatsapp_e164: payload.whatsapp_e164,
    description: payload.description,
    province: payload.province,
    city: payload.city,
    address: payload.address,
    lat: payload.lat,
    lng: payload.lng,
    years_experience: payload.years_experience,
    price_hint: payload.price_hint,
    emergency_available: payload.emergency_available,
    is_licensed: !!payload.is_licensed,
    business_hours: payload.business_hours
  });
  if (categoryIds.length > 0) await provider.setCategories(categoryIds);
  return getById(provider.id);
}

async function updateMine(userId, payload) {
  const mine = await getMine(userId);
  if (!mine) throw notFound('PROVIDER.NOT_FOUND', 'Aún no tienes perfil de proveedor');
  // Handle categories updates
  let categoryIds = null;
  if (Array.isArray(payload.category_ids)) {
    categoryIds = payload.category_ids;
  } else if (payload.category_id) {
    categoryIds = [payload.category_id];
  }
  if (categoryIds) {
    const found = await Category.findAll({ where: { id: { [Op.in]: categoryIds } } });
    if (found.length !== categoryIds.length) throw notFound('CATEGORY.NOT_FOUND', 'Una o más categorías inexistentes');
    // keep first as primary
    await mine.update({ ...payload, category_id: categoryIds[0] });
    await mine.setCategories(categoryIds);
  } else {
    await mine.update(payload);
  }
  return getMine(userId);
}

async function setAvatar(userId, avatar) {
  const mine = await getMine(userId);
  if (!mine) throw notFound('PROVIDER.NOT_FOUND', 'Aún no tienes perfil de proveedor');
  await mine.update({
    avatar_url: avatar.url,
    avatar_public_id: avatar.publicId,
    avatar_version: avatar.version
  });
  return mine;
}

async function clearAvatar(userId) {
  const mine = await getMine(userId);
  if (!mine) throw notFound('PROVIDER.NOT_FOUND', 'Aún no tienes perfil de proveedor');
  await mine.update({ avatar_url: null, avatar_public_id: null, avatar_version: null });
  return mine;
}

/**
 * Listado con filtros básicos y, opcionalmente, distancia (Haversine).
 * params: { categorySlug, city, lat, lng, radiusKm, limit, offset }
 */
async function list(params = {}) {
  const where = {};
  const include = [];
  try { console.log('[list] params:', params); } catch (_e) { }
  if (params.city) where.city = params.city;
  if (params.status) where.status = params.status;
  if (params.isLicensed === true) where.is_licensed = true;

  if (params.categorySlug) {
    // Use OR condition to match either primary category or any of many-to-many categories
    where[Op.or] = [
      { '$category.slug$': params.categorySlug },
      { '$categories.slug$': params.categorySlug }
    ];
    include.push({ model: Category, as: 'category', required: false, attributes: ['id', 'name', 'slug', 'icon'] });
    include.push({ model: Category, as: 'categories', required: false, attributes: ['id', 'name', 'slug', 'icon'] });
  } else {
    include.push({ model: Category, as: 'category', required: false, attributes: ['id', 'name', 'slug', 'icon'] });
    include.push({ model: Category, as: 'categories', required: false, attributes: ['id', 'name', 'slug', 'icon'] });
  }

  const query = { where, include, limit: Math.min(Number(params.limit || 20), 100), offset: Number(params.offset || 0), order: [['id', 'ASC']] };

  // Filtro por distancia (opcional)
  const lat = parseFloat(params.lat), lng = parseFloat(params.lng), radius = Math.min(parseFloat(params.radiusKm || 0) || 0, 50);
  if (!Number.isNaN(lat) && !Number.isNaN(lng) && radius > 0) {
    // bounding box rápido
    const R = 6371;
    const latDelta = (radius / R) * (180 / Math.PI);
    const lngDelta = (radius / R) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
    where.lat = { [Op.between]: [lat - latDelta, lat + latDelta] };
    where.lng = { [Op.between]: [lng - lngDelta, lng + lngDelta] };

    // distancia exacta para ordenar
    query.attributes = {
      include: [
        [Sequelize.literal(`
          ${R} * acos(
            cos(radians(${lat})) * cos(radians(CAST(lat AS DOUBLE PRECISION))) *
            cos(radians(CAST(lng AS DOUBLE PRECISION)) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(CAST(lat AS DOUBLE PRECISION)))
          )
        `), 'distance_km']
      ]
    };
    query.order = Sequelize.literal('distance_km ASC NULLS LAST');
  }

  // Evitar problemas con includes + limit y filtros por alias ($alias.col$)
  // distinct para que el count sea correcto con joins y subQuery:false para que
  // el WHERE con $category.slug$/$categories.slug$ funcione correctamente.
  query.distinct = true;
  query.subQuery = false;
  try {
    return await Provider.findAndCountAll(query);
  } catch (error) {
    console.error('[list] Query error:', error.message);
    console.error('[list] Query:', JSON.stringify(query, null, 2));
    throw error;
  }
}

async function getProviderSummary() {
  const total = await Provider.count();
  const active = await Provider.count({ where: { status: 'active' } });
  return { total, active };
}

module.exports = { getById, getMine, createOrGetMine, updateMine, list, setAvatar, clearAvatar, getProviderSummary };
