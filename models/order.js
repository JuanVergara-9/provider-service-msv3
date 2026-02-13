'use strict';
module.exports = (sequelize, DataTypes) => {
    const Order = sequelize.define('Order', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        user_id: { type: DataTypes.INTEGER, allowNull: false },
        category_id: { type: DataTypes.INTEGER, allowNull: false },
        title: { type: DataTypes.STRING(200), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: false },
        lat: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
        lng: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
        status: {
            type: DataTypes.ENUM('PENDING', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
            defaultValue: 'PENDING'
        },
        images: { type: DataTypes.JSONB, defaultValue: [] },
        budget_estimate: { type: DataTypes.STRING(100) },
        winner_provider_id: { type: DataTypes.INTEGER, allowNull: true },
        final_agreed_price: { type: DataTypes.DECIMAL(12, 2), allowNull: true }
    }, { tableName: 'orders', underscored: true });

    Order.associate = (models) => {
        Order.belongsTo(models.Category, { as: 'category', foreignKey: 'category_id' });
        Order.belongsTo(models.Provider, { as: 'winner_provider', foreignKey: 'winner_provider_id' });
        Order.hasMany(models.Postulation, { as: 'postulations', foreignKey: 'order_id' });
    };

    return Order;
};
