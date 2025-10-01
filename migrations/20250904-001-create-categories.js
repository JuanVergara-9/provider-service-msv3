'use strict';
module.exports = {
  async up(q, S) {
    await q.createTable('categories', {
      id: { type: S.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: S.STRING(80), allowNull: false },
      slug: { type: S.STRING(80), allowNull: false, unique: true },
      icon: { type: S.STRING(80) },
      sort_order: { type: S.SMALLINT, allowNull: false, defaultValue: 0 },
      created_at: { type: S.DATE, allowNull: false, defaultValue: S.fn('NOW') },
      updated_at: { type: S.DATE, allowNull: false, defaultValue: S.fn('NOW') }
    });
    await q.addIndex('categories', ['slug'], { unique: true, name: 'categories_slug_uq' });
  },
  async down(q){ await q.dropTable('categories'); }
};
