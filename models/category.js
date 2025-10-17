'use strict';
module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(80), allowNull: false },
    slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    icon: DataTypes.STRING(80),
    sort_order: { type: DataTypes.SMALLINT, defaultValue: 0 }
  }, { tableName: 'categories', underscored: true });

  Category.associate = (models) => {
    // Legacy one-to-many
    Category.hasMany(models.Provider, { as: 'providers', foreignKey: 'category_id' });
    // New many-to-many
    Category.belongsToMany(models.Provider, {
      as: 'providers_many',
      through: 'provider_categories',
      foreignKey: 'category_id',
      otherKey: 'provider_id'
    });
  };

  return Category;
};
