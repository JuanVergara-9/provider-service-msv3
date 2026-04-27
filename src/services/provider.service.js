const { Provider, Category } = require('../../models');
const { conflict, notFound } = require('../utils/httpError');
const { Op, Sequelize } = require('sequelize');

async function geocodeCity(city, province) {
  if (!city) return null;
  
  try {
    const geoUrl = process.env.GEOLOCATION_SERVICE_URL || process.env.GEO_SERVICE_URL || 'http://localhost:4003';
    const url = new URL('/api/v1/geo/geocode', geoUrl);
    url.searchParams.set('city', city);
    if (province) url.searchParams.set('province', province);
    
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    
    const data = await response.json();
    return { lat: data.lat, lng: data.lng };
  } catch (error) {
    console.warn('[geocodeCity] Error geocoding:', error.message);
    return null;
  }
}

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

  try {
    const result = await Provider.findOne(query);
    return result;
  } catch (error) {
    console.error('[getMine] Database error:', error.message);
    throw error;
  }
}

async function createOrGetMine(userId, payload) {
  const existing = await getMine(userId);
  if (existing) return existing;

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

  let finalLat = payload.lat;
  let finalLng = payload.lng;

  if (!finalLat || !finalLng) {
    if (payload.city) {
      const coords = await geocodeCity(payload.city, payload.province);
      if (coords) {
        finalLat = coords.lat;
        finalLng = coords.lng;
      }
    }
  }

  const provider = await Provider.create({
    user_id: userId,
    category_id: categoryIds[0],
    first_name: payload.first_name,
    last_name: payload.last_name,
    contact_email: payload.contact_email,
    phone_e164: payload.phone_e164,
    whatsapp_e164: payload.whatsapp_e164,
    description: payload.description,
    province: payload.province,
    city: payload.city,
    address: payload.address,
    lat: finalLat,
    lng: finalLng,
    years_experience: payload.years_experience,
    price_hint: payload.price_hint,
    emergency_available: payload.emergency_available,
    is_licensed: !!payload.is_licensed,
    business_hours: payload.business_hours,
    reputation_consent: payload.reputation_consent === true
  });
  if (categoryIds.length > 0) await provider.setCategories(categoryIds);
  return getById(provider.id);
}

/** Campos de confianza / suscripción: solo administración o procesos internos, no el perfil público PUT /mine */
const FORBIDDEN_SELF_UPDATE = new Set([
  'is_licensed', 'is_pro', 'has_background_check', 'is_certified',
  'certification_status', 'certification_doc_url', 'certification_rejection_reason',
  'identity_status', 'identity_dni_front_url', 'identity_dni_back_url', 'identity_selfie_url', 'identity_rejection_reason',
  'credits_balance', 'total_reviews', 'average_rating', 'total_earned', 'reputation_consent'
]);

async function updateMine(userId, payload) {
  const mine = await getMine(userId);
  if (!mine) throw notFound('PROVIDER.NOT_FOUND', 'Aún no tienes perfil de proveedor');

  const updatedPayload = { ...payload };
  for (const k of FORBIDDEN_SELF_UPDATE) delete updatedPayload[k];

  if (payload.city && (!payload.lat || !payload.lng)) {
    const coords = await geocodeCity(payload.city, payload.province || mine.province);
    if (coords) {
      updatedPayload.lat = coords.lat;
      updatedPayload.lng = coords.lng;
    }
  }

  let categoryIds = null;
  if (Array.isArray(payload.category_ids)) {
    categoryIds = payload.category_ids;
  } else if (payload.category_id) {
    categoryIds = [payload.category_id];
  }
  if (categoryIds) {
    const found = await Category.findAll({ where: { id: { [Op.in]: categoryIds } } });
    if (found.length !== categoryIds.length) throw notFound('CATEGORY.NOT_FOUND', 'Una o más categorías inexistentes');
    await mine.update({ ...updatedPayload, category_id: categoryIds[0] });
    await mine.setCategories(categoryIds);
  } else {
    await mine.update(updatedPayload);
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

async function setCertificationDocumentPending(userId, docUrl) {
  const mine = await getMine(userId);
  if (!mine) throw notFound('PROVIDER.NOT_FOUND', 'Aún no tienes perfil de proveedor');
  await mine.update({
    certification_doc_url: docUrl,
    certification_status: 'pending',
    certification_rejection_reason: null,
    is_certified: false
  });
  return getMine(userId);
}

/** Aceptación de consentimiento de reputación para perfiles legacy. */
async function acceptReputationConsent(userId) {
  const mine = await getMine(userId);
  if (!mine) throw notFound('PROVIDER.NOT_FOUND', 'Aún no tienes perfil de proveedor');
  if (mine.reputation_consent === true) return mine;
  await mine.update({ reputation_consent: true });
  return getMine(userId);
}

/**
 * Listado con filtros básicos y, opcionalmente, distancia (Haversine).
 * params: { categorySlug, categoryName, city, lat, lng, radiusKm, limit, offset, urgency }
 *
 * Siempre se prioriza identity_status = 'verified' antes que el resto del orden (is_pro, distancia, etc.).
 * Con distinct + JOINs, PostgreSQL exige que lo ordenado salga en el SELECT: usamos alias _verifiedSort.
 */
async function list(params = {}) {
  const where = {};
  const include = [];

  const verifiedSortAttr = [
    Sequelize.literal(`CASE WHEN "Provider"."identity_status" = 'verified' THEN 1 ELSE 2 END`),
    '_verifiedSort'
  ];

  // Filtro por zona: buscar en city O province (el parámetro city representa la zona general)
  const cityOrProvinceCondition = params.city
    ? {
        [Op.or]: [
          { city: { [Op.iLike]: `%${params.city}%` } },
          { province: { [Op.iLike]: `%${params.city}%` } }
        ]
      }
    : null;
  if (cityOrProvinceCondition) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push(cityOrProvinceCondition);
  }

  if (params.status) where.status = params.status;
  if (params.identityStatus) where.identity_status = params.identityStatus;
  if (params.certificationStatus) where.certification_status = params.certificationStatus;

  // Filtro por categoría (Slug o Nombre)
  if (params.categorySlug || params.categoryName) {
    const categoryConditions = [];
    if (params.categorySlug) {
      categoryConditions.push({ '$category.slug$': params.categorySlug });
      categoryConditions.push({ '$categories.slug$': params.categorySlug });
    }
    if (params.categoryName) {
      categoryConditions.push({ '$category.name$': { [Op.iLike]: `%${params.categoryName}%` } });
      categoryConditions.push({ '$categories.name$': { [Op.iLike]: `%${params.categoryName}%` } });
    }

    const categoryOr = { [Op.or]: categoryConditions };
    if (where[Op.and]) {
      where[Op.and].push(categoryOr);
    } else {
      where[Op.or] = categoryConditions;
    }
    include.push({ model: Category, as: 'category', required: false, attributes: ['id', 'name', 'slug', 'icon'] });
    include.push({ model: Category, as: 'categories', required: false, attributes: ['id', 'name', 'slug', 'icon'] });
  } else {
    include.push({ model: Category, as: 'category', required: false, attributes: ['id', 'name', 'slug', 'icon'] });
    include.push({ model: Category, as: 'categories', required: false, attributes: ['id', 'name', 'slug', 'icon'] });
  }

  // Orden por defecto (verificados primero, luego PRO, recientes, id estable)
  let order = [
    ['_verifiedSort', 'ASC'],
    ['is_pro', 'DESC'],
    ['createdAt', 'DESC'],
    ['id', 'ASC']
  ];

  // Si la urgencia es alta, priorizar emergency_available (siempre después de verificados)
  if (params.urgency && (params.urgency.toLowerCase() === 'alta' || params.urgency.toLowerCase() === 'urgente')) {
    order = [
      ['_verifiedSort', 'ASC'],
      ['emergency_available', 'DESC'],
      ['is_pro', 'DESC'],
      ['createdAt', 'DESC'],
      ['id', 'ASC']
    ];
  }

  const query = {
    where,
    include,
    limit: Math.min(Number(params.limit || 20), 100),
    offset: Number(params.offset || 0),
    order,
    attributes: { include: [verifiedSortAttr] },
    distinct: true,
    subQuery: false
  };

  // Filtro por distancia (opcional). Si ya hay Op.or (categoría), combinamos con Op.and para no pisarlo.
  const lat = parseFloat(params.lat), lng = parseFloat(params.lng), radius = Math.min(parseFloat(params.radiusKm || 0) || 0, 200);
  if (!Number.isNaN(lat) && !Number.isNaN(lng) && radius > 0) {
    const R = 6371;
    const latDelta = (radius / R) * (180 / Math.PI);
    const lngDelta = (radius / R) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);

    const radiusCondition = {
      [Op.or]: [
        {
          lat: { [Op.between]: [lat - latDelta, lat + latDelta] },
          lng: { [Op.between]: [lng - lngDelta, lng + lngDelta] }
        },
        { [Op.or]: [{ lat: null }, { lng: null }] }
      ]
    };

    if (where[Op.or]) {
      where[Op.and] = [{ [Op.or]: where[Op.or] }, radiusCondition];
      delete where[Op.or];
    } else {
      where[Op.or] = radiusCondition[Op.or];
    }

    query.attributes = {
      include: [
        verifiedSortAttr,
        [Sequelize.literal(`
          CASE 
            WHEN lat IS NULL OR lng IS NULL THEN NULL
            ELSE ${R} * acos(
              cos(radians(${lat})) * cos(radians(CAST(lat AS DOUBLE PRECISION))) *
              cos(radians(CAST(lng AS DOUBLE PRECISION)) - radians(${lng})) +
              sin(radians(${lat})) * sin(radians(CAST(lat AS DOUBLE PRECISION)))
            )
          END
        `), 'distance_km']
      ]
    };
    query.order = [
      ['_verifiedSort', 'ASC'],
      Sequelize.literal('distance_km ASC NULLS LAST'),
      ['createdAt', 'DESC'],
      ['id', 'ASC']
    ];
  }

  try {
    return await Provider.findAndCountAll(query);
  } catch (error) {
    console.error('[list] Query error:', error.message);
    throw error;
  }
}

async function getProviderSummary() {
  const total = await Provider.count();
  const active = await Provider.count({ where: { status: 'active' } });
  return { total, active };
}

async function getProviderUserIds() {
  const providers = await Provider.findAll({
    attributes: ['user_id'],
    raw: true
  });
  const userIds = providers.map(p => p.user_id).filter(id => id != null);
  return { userIds };
}

/**
 * Sincroniza una nueva reseña e ingreso con el perfil del proveedor (CV Vivo).
 * @param {number} providerId - ID del proveedor.
 * @param {object} payload - { newRating: number (1-5), amountEarned: number }
 * @returns {Promise<object|null>} Provider actualizado o null.
 */
async function syncStats(providerId, payload) {
  const { newRating, amountEarned } = payload;
  const provider = await Provider.findByPk(providerId);
  if (!provider) return null;

  const oldTotal = Number(provider.total_reviews || 0);
  const oldAvg = Number(provider.average_rating || 0);
  const totalReviews = oldTotal + 1;
  const averageRating = ((oldAvg * oldTotal) + newRating) / totalReviews;
  const totalEarned = (Number(provider.total_earned) || 0) + Number(amountEarned || 0);

  await provider.update({
    total_reviews: totalReviews,
    average_rating: Number(averageRating.toFixed(2)),
    total_earned: totalEarned
  });
  return provider;
}

/**
 * Lectura mínima para servicios internos (ej. notification-service, consent hook).
 * @param {number|string} providerId
 * @returns {Promise<{ reputation_consent: boolean }|null>} null si no existe el proveedor
 */
async function getReputationConsent(providerId) {
  const id = Number(providerId);
  if (!id || Number.isNaN(id)) return null;
  const p = await Provider.findByPk(id, { attributes: ['id', 'reputation_consent'] });
  if (!p) return null;
  return { reputation_consent: p.reputation_consent === true };
}

module.exports = {
  getById,
  getMine,
  createOrGetMine,
  updateMine,
  list,
  setAvatar,
  clearAvatar,
  setCertificationDocumentPending,
  acceptReputationConsent,
  getProviderSummary,
  getProviderUserIds,
  syncStats,
  getReputationConsent
};
