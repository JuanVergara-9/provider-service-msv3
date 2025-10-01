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
    Category.hasMany(models.Provider, { as: 'providers', foreignKey: 'category_id' });
  };

  return Category;
};
