'use strict';

/**
 * Shadow Ledger / GMV: Agrega final_agreed_price a orders.
 * Almacena el budget de la postulación ganadora al momento del match.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'orders',
      'final_agreed_price',
      {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('orders', 'final_agreed_price');
  }
};
