// models/users.js
const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Users extends Model {
    static associate(models) {
      Users.belongsTo(models.Events, { foreignKey: 'eventId', as: 'event' });
    }
  }
  
  Users.init({
    name: DataTypes.STRING,
    email: DataTypes.STRING,
    phone: DataTypes.STRING,
    eventId: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Users',
  });

  return Users;
};
