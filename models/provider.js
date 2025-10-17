'use strict';
module.exports = (sequelize, DataTypes) => {
  const Provider = sequelize.define('Provider', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    category_id: { type: DataTypes.INTEGER, allowNull: false },
    first_name: { type: DataTypes.STRING(60), allowNull: false },
    last_name: { type: DataTypes.STRING(60), allowNull: false },
    contact_email: DataTypes.STRING(160),
    phone_e164: DataTypes.STRING(32),
    whatsapp_e164: DataTypes.STRING(32),
    description: DataTypes.TEXT,
    province: DataTypes.STRING(80),
    city: DataTypes.STRING(80),
    address: DataTypes.STRING(160),
    lat: DataTypes.DECIMAL(10,7),
    lng: DataTypes.DECIMAL(10,7),
    status: { type: DataTypes.STRING(16), defaultValue: 'active' },
    years_experience: DataTypes.SMALLINT,
    price_hint: DataTypes.INTEGER,
    emergency_available: { type: DataTypes.BOOLEAN, defaultValue: false },
    business_hours: DataTypes.JSONB,
    avatar_url: DataTypes.STRING(512),
    avatar_public_id: DataTypes.STRING(256),
    avatar_version: DataTypes.STRING(64)
  }, { tableName: 'providers', underscored: true });

  Provider.associate = (models) => {
    // Legacy main category (kept for backward compatibility)
    Provider.belongsTo(models.Category, { as: 'category', foreignKey: 'category_id' });
    // New many-to-many categories
    Provider.belongsToMany(models.Category, {
      as: 'categories',
      through: 'provider_categories',
      foreignKey: 'provider_id',
      otherKey: 'category_id'
    });
  };

  return Provider;
};
