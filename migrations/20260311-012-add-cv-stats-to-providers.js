'use strict';

/** CV Vivo: columnas para reseñas e ingresos del Shadow Ledger */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('providers', 'total_reviews', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn('providers', 'average_rating', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn('providers', 'total_earned', {
      type: Sequelize.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('providers', 'total_reviews');
    await queryInterface.removeColumn('providers', 'average_rating');
    await queryInterface.removeColumn('providers', 'total_earned');
  }
};
