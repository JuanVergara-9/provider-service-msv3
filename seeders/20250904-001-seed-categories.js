'use strict';
module.exports = {
  async up(q) {
    const now = new Date();
    const rows = [
      { name: 'Plomería', slug: 'plomeria', icon: 'pipe', sort_order: 1 },
      { name: 'Gasistas', slug: 'gasistas', icon: 'flame', sort_order: 2 },
      { name: 'Electricidad', slug: 'electricidad', icon: 'zap', sort_order: 3 },
      { name: 'Jardinería', slug: 'jardineria', icon: 'leaf', sort_order: 4 },
      { name: 'Mantenimiento y limpieza de piletas', slug: 'mantenimiento-limpieza-piletas', icon: 'pool', sort_order: 5 },
      { name: 'Reparación de electrodomésticos', slug: 'reparacion-electrodomesticos', icon: 'wrench', sort_order: 6 }
    ];

    // UPSERT por slug para evitar errores de duplicado al re-ejecutar el seeder
    for (const r of rows) {
      await q.sequelize.query(`
        INSERT INTO categories (name, slug, icon, sort_order, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (slug)
        DO UPDATE SET
          name = EXCLUDED.name,
          icon = EXCLUDED.icon,
          sort_order = EXCLUDED.sort_order,
          updated_at = EXCLUDED.updated_at
      `, { bind: [r.name, r.slug, r.icon, r.sort_order, now, now] });
    }

    // Remapear proveedores y pivot a la nueva categoría antes de eliminar las viejas
    // carpinteria -> jardineria
    await q.sequelize.query(`
      UPDATE providers SET category_id = tgt.id
      FROM (SELECT id FROM categories WHERE slug='jardineria') AS tgt
      WHERE category_id = (SELECT id FROM categories WHERE slug='carpinteria' LIMIT 1)
    `);
    await q.sequelize.query(`
      UPDATE provider_categories SET category_id = tgt.id
      FROM (SELECT id FROM categories WHERE slug='jardineria') AS tgt
      WHERE category_id = (SELECT id FROM categories WHERE slug='carpinteria' LIMIT 1)
    `);

    // pintura -> jardineria
    await q.sequelize.query(`
      UPDATE providers SET category_id = tgt.id
      FROM (SELECT id FROM categories WHERE slug='jardineria') AS tgt
      WHERE category_id = (SELECT id FROM categories WHERE slug='pintura' LIMIT 1)
    `);
    await q.sequelize.query(`
      UPDATE provider_categories SET category_id = tgt.id
      FROM (SELECT id FROM categories WHERE slug='jardineria') AS tgt
      WHERE category_id = (SELECT id FROM categories WHERE slug='pintura' LIMIT 1)
    `);

    // Ahora sí, eliminar categorías antiguas si existen
    await q.sequelize.query("DELETE FROM categories WHERE slug IN ('carpinteria','pintura')");
  },
  async down(q){ await q.bulkDelete('categories', null, {}); }
};
