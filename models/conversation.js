'use strict';
module.exports = (sequelize, DataTypes) => {
    const Conversation = sequelize.define('Conversation', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        clientId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'client_id',
            comment: 'ID of the User (Client) - External User Service'
        },
        providerId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'provider_id',
            comment: 'ID of the Provider'
        },
        serviceId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'service_id',
            comment: 'Optional: ID of the specific service/job context'
        }
    }, {
        tableName: 'conversations',
        underscored: true
    });

    Conversation.associate = (models) => {
        // Association with Messages
        Conversation.hasMany(models.Message, {
            as: 'messages',
            foreignKey: 'conversationId'
        });

        // Association with Provider (Local model)
        if (models.Provider) {
            Conversation.belongsTo(models.Provider, {
                as: 'provider',
                foreignKey: 'providerId'
            });
        }

        // Note: User model is external (in user-service), so we cannot define a belongsTo association here
        // unless we replicate the User model or use a distributed query strategy.
    };

    return Conversation;
};
