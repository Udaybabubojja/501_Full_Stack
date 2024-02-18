// migrations/20240218054417-create-teams.js

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Teams', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      eventId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Events', // Assuming the table name is 'Events'
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      memberNames: {
        type: Sequelize.ARRAY(Sequelize.STRING), // Define array type with string elements
        allowNull: false
      },
      memberEmails: {
        type: Sequelize.ARRAY(Sequelize.STRING), // Define array type with string elements
        allowNull: false
      },
      memberPhones: {
        type: Sequelize.ARRAY(Sequelize.STRING), // Define array type with string elements
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Teams');
  }
};
