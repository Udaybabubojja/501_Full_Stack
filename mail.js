const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false, 
    auth: {
        user: 'events_organiser@outlook.com', 
        pass: 'Events@Organiser' 
    }
});
module.exports = transporter;