'use strict';
module.exports = {
  async up(q) {
    const now = new Date();
    await q.bulkInsert('categories', [
      { name: 'Plomería', slug: 'plomeria', icon: 'pipe', sort_order: 1, created_at: now, updated_at: now },
      { name: 'Gasistas', slug: 'gasistas', icon: 'flame', sort_order: 2, created_at: now, updated_at: now },
      { name: 'Electricidad', slug: 'electricidad', icon: 'zap', sort_order: 3, created_at: now, updated_at: now },
      { name: 'Carpintería', slug: 'carpinteria', icon: 'hammer', sort_order: 4, created_at: now, updated_at: now },
      { name: 'Pintura', slug: 'pintura', icon: 'paint', sort_order: 5, created_at: now, updated_at: now },
      { name: 'Reparación de electrodomésticos', slug: 'reparacion-electrodomesticos', icon: 'wrench', sort_order: 6, created_at: now, updated_at: now }
    ]);
  },
  async down(q){ await q.bulkDelete('categories', null, {}); }
};
