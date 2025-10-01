'use strict';
module.exports = {
  async up(q, S) {
    await q.createTable('providers', {
      id: { type: S.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: S.INTEGER, allowNull: false, unique: true }, // 1 perfil por usuario
      category_id: { type: S.INTEGER, allowNull: false, references: { model: 'categories', key: 'id' }, onDelete: 'RESTRICT' },
      first_name: { type: S.STRING(60), allowNull: false },
      last_name:  { type: S.STRING(60), allowNull: false },
      contact_email: { type: S.STRING(160) },
      phone_e164: { type: S.STRING(32) },
      whatsapp_e164: { type: S.STRING(32) },
      description: { type: S.TEXT },
      province: { type: S.STRING(80) },
      city: { type: S.STRING(80) },
      address: { type: S.STRING(160) },
      lat: { type: S.DECIMAL(10,7) },
      lng: { type: S.DECIMAL(10,7) },
      status: { type: S.STRING(16), allowNull: false, defaultValue: 'active' }, // draft|active|paused|banned
      years_experience: { type: S.SMALLINT },
      price_hint: { type: S.INTEGER },
      emergency_available: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
      business_hours: { type: S.JSONB },
      // Avatar/image fields for Cloudinary
      avatar_url: { type: S.STRING(512) },
      avatar_public_id: { type: S.STRING(256) },
      avatar_version: { type: S.STRING(64) },
      created_at: { type: S.DATE, allowNull: false, defaultValue: S.fn('NOW') },
      updated_at: { type: S.DATE, allowNull: false, defaultValue: S.fn('NOW') }
    });
    await q.addIndex('providers', ['category_id'], { name: 'providers_category_idx' });
    await q.addIndex('providers', ['city'], { name: 'providers_city_idx' });
    await q.addIndex('providers', ['lat', 'lng'], { name: 'providers_lat_lng_idx' });
  },
  async down(q){ await q.dropTable('providers'); }
};
