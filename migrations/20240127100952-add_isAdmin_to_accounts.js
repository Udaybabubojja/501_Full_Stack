'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Accounts', 'isAdmin', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull:false, // Set a default value if needed
      validate: {
        notNull: true,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Accounts', 'isAdmin');
  },
};
