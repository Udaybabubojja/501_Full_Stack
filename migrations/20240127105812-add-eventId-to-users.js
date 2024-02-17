'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'eventId', {
      type: Sequelize.INTEGER,
      allowNull: true, // Temporarily allow null values
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Code to update existing null values if needed
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'eventId');
  },
};
