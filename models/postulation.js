'use strict';
module.exports = (sequelize, DataTypes) => {
    const Postulation = sequelize.define('Postulation', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        order_id: { type: DataTypes.INTEGER, allowNull: false },
        provider_id: { type: DataTypes.INTEGER, allowNull: false },
        status: {
            type: DataTypes.ENUM('SENT', 'ACCEPTED', 'REJECTED'),
            defaultValue: 'SENT'
        },
        message: { type: DataTypes.TEXT, allowNull: true },
        budget: { type: DataTypes.DECIMAL(12, 2), allowNull: true }
    }, { tableName: 'postulations', underscored: true });

    Postulation.associate = (models) => {
        Postulation.belongsTo(models.Order, { as: 'order', foreignKey: 'order_id' });
        Postulation.belongsTo(models.Provider, { as: 'provider', foreignKey: 'provider_id' });
    };

    return Postulation;
};
