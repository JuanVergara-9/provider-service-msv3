'use strict';

/**
 * Shadow Ledger: vincular postulaciones a service_requests, órdenes guest, estados MATCHED_PAID/MATCHED_DEBT, créditos en providers.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const dialect = queryInterface.sequelize.getDialect();

    // 1. Postulations: service_request_id (nullable)
    try {
      await queryInterface.addColumn('postulations', 'service_request_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'service_requests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
      await queryInterface.addIndex('postulations', ['service_request_id']);
    } catch (e) {
      if (!/already exists|duplicate/i.test(e.message)) throw e;
    }

    // 2. Orders: service_request_id, client_phone; user_id nullable
    try {
      await queryInterface.addColumn('orders', 'service_request_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'service_requests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    } catch (e) {
      if (!/already exists|duplicate/i.test(e.message)) throw e;
    }
    try {
      await queryInterface.addColumn('orders', 'client_phone', {
        type: Sequelize.STRING(32),
        allowNull: true
      });
    } catch (e) {
      if (!/already exists|duplicate/i.test(e.message)) throw e;
    }
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
      `).catch(() => {});
    } else {
      await queryInterface.changeColumn('orders', 'user_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      }).catch(() => {});
    }

    // 3. Order status: add MATCHED_PAID, MATCHED_DEBT (Postgres: add enum values)
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'MATCHED_PAID';
      `).catch(() => {});
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'MATCHED_DEBT';
      `).catch(() => {});
    }
    // SQLite / MySQL: enum is stored as string; model change is enough

    // 4. Providers: credits_balance, is_pro (Lead Fee / monetización)
    try {
      await queryInterface.addColumn('providers', 'credits_balance', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      });
    } catch (e) {
      if (!/already exists|duplicate/i.test(e.message)) throw e;
    }
    try {
      await queryInterface.addColumn('providers', 'is_pro', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    } catch (e) {
      if (!/already exists|duplicate/i.test(e.message)) throw e;
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('postulations', 'service_request_id').catch(() => {});
    await queryInterface.removeColumn('orders', 'service_request_id').catch(() => {});
    await queryInterface.removeColumn('orders', 'client_phone').catch(() => {});
    await queryInterface.removeColumn('providers', 'credits_balance').catch(() => {});
    await queryInterface.removeColumn('providers', 'is_pro').catch(() => {});
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('ALTER TABLE orders ALTER COLUMN user_id SET NOT NULL;').catch(() => {});
    }
  }
};
