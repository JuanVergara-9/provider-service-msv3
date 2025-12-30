'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Crear tabla orders
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'categories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      lat: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: false
      },
      lng: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
        defaultValue: 'PENDING',
        allowNull: false
      },
      images: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      budget_estimate: {
        type: Sequelize.STRING(100)
      },
      winner_provider_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'providers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // 2. Crear tabla postulations
    await queryInterface.createTable('postulations', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'orders',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      provider_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'providers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('SENT', 'ACCEPTED', 'REJECTED'),
        defaultValue: 'SENT',
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      budget: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // 3. Agregar índices para rendimiento
    await queryInterface.addIndex('orders', ['user_id']);
    await queryInterface.addIndex('orders', ['category_id']);
    await queryInterface.addIndex('orders', ['status']);
    await queryInterface.addIndex('postulations', ['order_id']);
    await queryInterface.addIndex('postulations', ['provider_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('postulations');
    await queryInterface.dropTable('orders');
    // Eliminar tipos ENUM si es necesario (Postgres específico)
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_postulations_status";');
  }
};

