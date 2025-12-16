'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Create Conversations Table
        await queryInterface.createTable('conversations', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            client_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'ID of the User (Client)'
            },
            provider_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'ID of the Provider'
            },
            service_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: 'Optional: ID of the specific service/job context'
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        // Create Messages Table
        await queryInterface.createTable('messages', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            conversation_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'conversations',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            sender_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'ID of the User/Provider sending the message'
            },
            content: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            is_read: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        // Add Indexes
        await queryInterface.addIndex('conversations', ['client_id']);
        await queryInterface.addIndex('conversations', ['provider_id']);
        await queryInterface.addIndex('messages', ['conversation_id']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('messages');
        await queryInterface.dropTable('conversations');
    }
};
