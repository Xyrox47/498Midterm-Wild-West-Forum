const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);


const mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY || 'your-api-key-here'
});

const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'sandbox-domain.mailgun.org';
const FROM_EMAIL = process.env.MAILGUN_FROM || 'noreply@yourdomain.com';

async function sendPasswordReset(email, username, token) {
  const message = {
    from: FROM_EMAIL,
    to: email,
    subject: 'Rubicunda Fan Site: Password Reset Token',
    text: `
    Thank you for using Rubicunda Fan Site, ${username}.
    Use the following token to login on the password reset page:

    ${token}

    If you didn't request a password reset, you can ignore this email.
    `
  }
    
  try {
    const response = await mg.messages.create(MAILGUN_DOMAIN, message);
    console.log("I worked!")
    return response;
  } catch (error) {
    console.log("I DID NOT worked!")

    console.log(error); //logs any error
  }
}

module.exports = {
    sendPasswordReset
};
// // config/email.js
// const nodemailer = require('nodemailer');

// // Create a transporter object using Gmail SMTP
// // We'll use environment variables for sensitive information
// // These will be loaded from .env file using node --env-file=.env
// const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//         user: process.env.GMAIL_USER,        // Your Gmail address
//         pass: process.env.GMAIL_APP_PASSWORD // Your App Password (16 characters, no spaces)
//     }
// });

// // What is a transporter?
// // The transporter is like a "mail carrier" that knows how to connect to Gmail's email servers
// // and deliver your messages. It handles:
// // - Connecting to Gmail's SMTP (Simple Mail Transfer Protocol) servers
// // - Authenticating with your Gmail account using your credentials
// // - Sending emails through Gmail's infrastructure
// // - Handling the technical details of email delivery
// //
// // Once created, you can reuse this transporter object to send multiple emails
// // without having to reconnect each time.

// // Function to send a plain text email
// async function sendEmail(to, subject, text) {
//     try {
//         const info = await transporter.sendMail({
//             from: process.env.GMAIL_USER,  // Sender address
//             to: to,                         // Recipient address
//             subject: subject,               // Email subject
//             text: text                     // Plain text body
//         });
        
//         console.log('Email sent successfully:', info.messageId);
//         return { success: true, messageId: info.messageId };
//     } catch (error) {
//         console.error('Error sending email:', error);
//         return { success: false, error: error.message };
//     }
// }


// module.exports = {
//     sendEmail
// };
