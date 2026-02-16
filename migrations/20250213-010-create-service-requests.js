'use strict';

/**
 * Shadow Ledger / Guest flow: tabla service_requests para pedidos vía Web/Bot (sin login).
 * Identificador único del cliente: client_phone (fricción cero).
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE "enum_service_requests_type" AS ENUM('URGENCIA', 'PRESUPUESTO');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
      await queryInterface.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE "enum_service_requests_status" AS ENUM('OPEN', 'MATCHED', 'CANCELLED');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
    }

    const tables = await queryInterface.showAllTables();
    if (tables.includes('service_requests')) return;

    await queryInterface.createTable('service_requests', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      client_phone: {
        type: Sequelize.STRING(32),
        allowNull: false
      },
      category: {
        type: Sequelize.STRING(80),
        allowNull: false,
        comment: 'ej: Plomero'
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('URGENCIA', 'PRESUPUESTO'),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('OPEN', 'MATCHED', 'CANCELLED'),
        defaultValue: 'OPEN',
        allowNull: false
      },
      lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('service_requests', ['client_phone']);
    await queryInterface.addIndex('service_requests', ['status']);
    await queryInterface.addIndex('service_requests', ['category_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('service_requests');
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_service_requests_type";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_service_requests_status";');
    }
  }
};
