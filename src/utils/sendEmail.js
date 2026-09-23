const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. Transporter banayein (Gmail service ke sath)
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER, // Aapki email (Hum ise .env me daalenge)
      pass: process.env.EMAIL_PASS, // Aapka App Password (.env me daalenge)
    },
  });

  // 2. Email ke options set karein
  const mailOptions = {
    from: `"Local Services App" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html, // Agar koi khoobsurat HTML template bhejna ho
  };

  // 3. Email send karein
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;