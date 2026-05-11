const nodemailer = require('nodemailer');

// Do NOT load dotenv here; the application already configures environment variables (see server.js).
const { EMAIL_USER, EMAIL_PASS } = process.env;

if (!EMAIL_USER || !EMAIL_PASS) {
  console.warn('[mail] Warning: EMAIL_USER or EMAIL_PASS is not set. Mailer will be disabled until configured.');
}

// Create a reusable transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Optional verify helper (async) — callers can await this to ensure credentials are valid
const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('[mail] Transporter verified');
    return true;
  } catch (err) {
    console.warn('[mail] Transporter verification failed:', err && err.message ? err.message : err);
    return false;
  }
};

module.exports = {
  transporter,
  verifyTransporter
};
