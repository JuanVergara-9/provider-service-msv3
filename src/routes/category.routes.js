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
        [sequelize.fn('COUNT', sequelize.col('providers.id')), 'provider_count']
      ],
      include: [{
        model: Provider,
        as: 'providers',
        attributes: [],
        where: { status: 'active' },
        required: false
      }],
      group: ['Category.id'],
      order: [['sort_order', 'ASC'], ['name', 'ASC']]
    });
    res.json({ items });
  } catch (e) { next(e); }
});

module.exports = router;
