'use strict';
module.exports = {
  async up(q, S){
    await q.createTable('provider_categories', {
      id: { type: S.INTEGER, autoIncrement: true, primaryKey: true },
      provider_id: { type: S.INTEGER, allowNull: false, references: { model: 'providers', key: 'id' }, onDelete: 'CASCADE' },
      category_id: { type: S.INTEGER, allowNull: false, references: { model: 'categories', key: 'id' }, onDelete: 'RESTRICT' },
      created_at: { type: S.DATE, allowNull: false, defaultValue: S.fn('NOW') },
      updated_at: { type: S.DATE, allowNull: false, defaultValue: S.fn('NOW') }
    });
    await q.addConstraint('provider_categories', {
      fields: ['provider_id','category_id'],
      type: 'unique',
      name: 'provider_categories_provider_id_category_id_uq'
    });

    // Backfill from existing providers.category_id
    // Note: safe even if empty; ignore conflicts via ON CONFLICT if supported
    try {
      await q.sequelize.query(`
        INSERT INTO provider_categories (provider_id, category_id, created_at, updated_at)
        SELECT id as provider_id, category_id, NOW(), NOW()
        FROM providers
        WHERE category_id IS NOT NULL
      `);
    } catch(_e) { /* ignore */ }
  },
  async down(q){
    await q.dropTable('provider_categories');
  }
};


