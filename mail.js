const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false, 
    auth: {
        user: 'Event_organiser@outlook.com', 
        pass: 'Event@organiser' 
    }
});
module.exports = transporter;