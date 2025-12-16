'use strict';
module.exports = (sequelize, DataTypes) => {
    const Message = sequelize.define('Message', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        conversationId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'conversation_id',
            references: {
                model: 'conversations',
                key: 'id'
            }
        },
        senderId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'sender_id',
            comment: 'ID of the User/Provider sending the message'
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        isRead: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_read'
        },
        deliveryStatus: {
            type: DataTypes.ENUM('pending', 'sent', 'delivered', 'read'),
            defaultValue: 'sent',
            field: 'delivery_status',
            comment: 'Estado de entrega: pending (enviando), sent (enviado), delivered (entregado), read (leído)'
        }
    }, {
        tableName: 'messages',
        underscored: true
    });

    Message.associate = (models) => {
        Message.belongsTo(models.Conversation, {
            as: 'conversation',
            foreignKey: 'conversationId'
        });
    };

    return Message;
};
