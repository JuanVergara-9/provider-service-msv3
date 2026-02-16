'use strict';

module.exports = (sequelize, DataTypes) => {
  const ServiceRequest = sequelize.define('ServiceRequest', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    client_phone: { type: DataTypes.STRING(32), allowNull: false },
    category: { type: DataTypes.STRING(80), allowNull: false },
    category_id: { type: DataTypes.INTEGER, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: false },
    type: {
      type: DataTypes.ENUM('URGENCIA', 'PRESUPUESTO'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('OPEN', 'MATCHED', 'CANCELLED'),
      defaultValue: 'OPEN',
      allowNull: false
    },
    lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true }
  }, { tableName: 'service_requests', underscored: true });

  ServiceRequest.associate = (models) => {
    ServiceRequest.belongsTo(models.Category, { as: 'categoryRef', foreignKey: 'category_id' });
    ServiceRequest.hasMany(models.Postulation, { as: 'postulations', foreignKey: 'service_request_id' });
  };

  return ServiceRequest;
};
