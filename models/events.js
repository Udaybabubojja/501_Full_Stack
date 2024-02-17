// models/events.js
const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Events extends Model {
    static associate(models) {
      Events.hasMany(models.Users, { foreignKey: 'eventId', as: 'users' });
    }
  }

  Events.init({
    email: DataTypes.STRING,
    eventName: DataTypes.STRING,
    maxSize: DataTypes.INTEGER,
    description: DataTypes.STRING,
    date: DataTypes.DATEONLY,
  }, {
    sequelize,
    modelName: 'Events',
  });

  return Events;
};
