const { Provider, Category } = require('../../models');
const { conflict, notFound } = require('../utils/httpError');
const { Op, Sequelize } = require('sequelize');

async function getById(id){
  const p = await Provider.findByPk(id, { include:[{ model: Category, as:'category', attributes:['id','name','slug','icon'] }] });
  if(!p) throw notFound('PROVIDER.NOT_FOUND','Proveedor no encontrado');
  return p;
}

async function getMine(userId){
  console.log('[getMine] Searching for provider with userId:', userId, typeof userId);
  
  // Validar que userId es un número válido
  if (!userId || isNaN(userId) || userId <= 0) {
    console.error('[getMine] Invalid userId in service:', userId);
    throw new Error('Invalid userId provided to getMine service');
  }
  
  const query = { 
    where: { user_id: userId }, 
    include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'icon'] }] 
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

async function createOrGetMine(userId, payload){
  const existing = await getMine(userId);
  if(existing) return existing; // idempotente

  // valida existencia de categoría
  const cat = await Category.findByPk(payload.category_id);
  if(!cat) throw notFound('CATEGORY.NOT_FOUND','Categoría inexistente');

  return Provider.create({ ...payload, user_id:userId });
}

async function updateMine(userId, payload){
  const mine = await getMine(userId);
  if(!mine) throw notFound('PROVIDER.NOT_FOUND','Aún no tienes perfil de proveedor');
  if(payload.category_id){
    const cat = await Category.findByPk(payload.category_id);
    if(!cat) throw notFound('CATEGORY.NOT_FOUND','Categoría inexistente');
  }
  await mine.update(payload);
  return mine;
}

async function setAvatar(userId, avatar) {
  const mine = await getMine(userId);
  if(!mine) throw notFound('PROVIDER.NOT_FOUND','Aún no tienes perfil de proveedor');
  await mine.update({
    avatar_url: avatar.url,
    avatar_public_id: avatar.publicId,
    avatar_version: avatar.version
  });
  return mine;
}

async function clearAvatar(userId) {
  const mine = await getMine(userId);
  if(!mine) throw notFound('PROVIDER.NOT_FOUND','Aún no tienes perfil de proveedor');
  await mine.update({ avatar_url: null, avatar_public_id: null, avatar_version: null });
  return mine;
}

/**
 * Listado con filtros básicos y, opcionalmente, distancia (Haversine).
 * params: { categorySlug, city, lat, lng, radiusKm, limit, offset }
 */
async function list(params={}){
  const where = {};
  const include = [];
  if (params.city) where.city = params.city;
  if (params.status) where.status = params.status;

  if (params.categorySlug) {
    include.push({ model: Category, as:'category', where:{ slug: params.categorySlug }, required:true, attributes:['id','name','slug','icon'] });
  } else {
    include.push({ model: Category, as:'category', attributes:['id','name','slug','icon'] });
  }

  const query = { where, include, limit: Math.min(Number(params.limit||20), 100), offset: Number(params.offset||0), order:[['id','ASC']] };

  // Filtro por distancia (opcional)
  const lat = parseFloat(params.lat), lng = parseFloat(params.lng), radius = Math.min(parseFloat(params.radiusKm||0)||0, 50);
  if (!Number.isNaN(lat) && !Number.isNaN(lng) && radius>0) {
    // bounding box rápido
    const R = 6371;
    const latDelta = (radius / R) * (180/Math.PI);
    const lngDelta = (radius / R) * (180/Math.PI) / Math.cos(lat * Math.PI/180);
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

  return Provider.findAndCountAll(query);
}

module.exports = { getById, getMine, createOrGetMine, updateMine, list, setAvatar, clearAvatar };
