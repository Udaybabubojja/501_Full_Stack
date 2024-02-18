'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Teams extends Model {
    static associate(models) {
      Teams.belongsTo(models.Events, { foreignKey: 'eventId', as: 'event' });
    }
    static async doesTeamExist(name) {
      const team = await Teams.findOne({ where: { name } });
      return team;
    }
  }
  Teams.init({
    name: DataTypes.STRING,
    eventId: DataTypes.INTEGER,
    memberNames: DataTypes.ARRAY(DataTypes.STRING),
    memberEmails: DataTypes.ARRAY(DataTypes.STRING),
    memberPhones: DataTypes.ARRAY(DataTypes.STRING),
  }, {
    sequelize,
    modelName: 'Teams',
  });
  return Teams;
};
