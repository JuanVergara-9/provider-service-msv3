const router = require('express').Router();
const { Category, Provider, sequelize } = require('../../models');

router.get('/', async (_req, res, next) => {
  try {
    const items = await Category.findAll({ order: [['sort_order', 'ASC'], ['name', 'ASC']], attributes: ['id', 'name', 'slug', 'icon', 'sort_order'] });
    res.json({ items });
  } catch (e) { next(e); }
});

// Get categories with provider counts
router.get('/with-counts', async (_req, res, next) => {
  try {
    const items = await Category.findAll({
      attributes: [
        'id', 'name', 'slug', 'icon', 'sort_order',
        [
          sequelize.literal(`(
            SELECT COUNT(DISTINCT p.id)
            FROM providers AS p
            LEFT JOIN provider_categories AS pc ON p.id = pc.provider_id
            WHERE p.status = 'active' 
              AND (p.category_id = "Category".id OR pc.category_id = "Category".id)
          )`),
          'provider_count'
        ]
      ],
      order: [['sort_order', 'ASC'], ['name', 'ASC']]
    });
    res.json({ items });
  } catch (e) { next(e); }
});

module.exports = router;
