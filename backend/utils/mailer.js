const nodemailer = require('nodemailer');
const { normalizeWhitespace } = require('./nameUtils');

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isTruthy = (value) => String(value).toLowerCase() === 'true';

let cachedTransporter = null;
let transporterVerified = false;

const stripWhitespace = (value) => String(value || '').replace(/\s+/g, '').trim();

const getSmtpConfig = () => {
  const service = stripWhitespace(process.env.SMTP_SERVICE);
  const host = stripWhitespace(process.env.SMTP_HOST);
  const port = toInt(process.env.SMTP_PORT, 587);
  const secure = isTruthy(process.env.SMTP_SECURE);
  const user = stripWhitespace(process.env.SMTP_USER);
  const pass = stripWhitespace(process.env.SMTP_PASS);

  // Strip potential literal quotes if they were added in the hosting dashboard
  let from = normalizeWhitespace(process.env.SMTP_FROM || '');
  if (from.startsWith('"') && from.endsWith('"')) {
    from = from.slice(1, -1);
  }

  return {
    service,
    host,
    port,
    secure,
    user,
    pass,
    from: from || 'no-reply@academicdebate.local',
    fallbackAllowed: isTruthy(process.env.SMTP_ALLOW_FALLBACK)
  };
};

const getTransporter = async () => {
  const smtp = getSmtpConfig();
  const hasProvider = Boolean(smtp.service || smtp.host);

  if (!hasProvider || !smtp.user || !smtp.pass) {
    if (smtp.fallbackAllowed) {
      return { transporter: null, from: smtp.from, fallback: true };
    }

    throw new Error(
      'SMTP is not fully configured. Set SMTP_SERVICE (or SMTP_HOST), SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.'
    );
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport(
      smtp.service
        ? {
            service: smtp.service,
            auth: { user: smtp.user, pass: smtp.pass }
          }
        : {
            host: smtp.host,
            port: smtp.port,
            secure: smtp.secure,
            auth: { user: smtp.user, pass: smtp.pass }
          }
    );
  }

  if (!transporterVerified) {
    await cachedTransporter.verify();
    transporterVerified = true;
  }

  return { transporter: cachedTransporter, from: smtp.from, fallback: false };
};

const sendPasswordResetEmail = async ({ to, resetLink, name }) => {
  const { transporter, from, fallback } = await getTransporter();
  const subject = 'Reset your Academic Debate password';
  const text = `Hi ${name},\n\nUse this link to reset your password:\n${resetLink}\n\nThis link expires in 1 hour.`;
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">Password Reset Request</h2>
      <p>Hi ${name},</p>
      <p>Use the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
      <p style="margin: 18px 0;">
        <a href="${resetLink}" style="display:inline-block;padding:10px 14px;border-radius:10px;color:#ffffff;background:linear-gradient(135deg,#4f46e5,#7c3aed);text-decoration:none;font-weight:600;">
          Reset Password
        </a>
      </p>
      <p>If the button doesn’t work, copy this link:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
    </div>
  `;

  if (!transporter && fallback) {
    console.log(`[MAILER] SMTP fallback mode enabled. Password reset email not delivered.`);
    console.log(`[MAILER] SIMULATED EMAIL CONTENT for ${to}:`);
    console.log(`         Subject: ${subject}`);
    console.log(`         Link: ${resetLink}`);
    return { delivered: true, fallback: true };
  }

  await transporter.sendMail({ from, to, subject, text, html });
  return { delivered: true, fallback: false };
};

const sendOTPEmail = async ({ to, otp, purpose }) => {
  const { transporter, from, fallback } = await getTransporter();
  const subject =
    purpose === 'forgot_password'
      ? 'Your Academic Debate password reset OTP'
      : 'Your Academic Debate signup OTP';
  const text = `Your OTP is ${otp}. It expires in 5 minutes.`;
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">One-Time Password (OTP)</h2>
      <p>Your verification code is:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 12px 0 16px;">${otp}</p>
      <p>This code expires in <strong>5 minutes</strong>.</p>
      <p style="margin-top: 12px; color: #64748b;">If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  if (!transporter && fallback) {
    console.log(`[MAILER] SMTP fallback mode enabled. OTP email not delivered.`);
    console.log(`[MAILER] SIMULATED EMAIL CONTENT for ${to}:`);
    console.log(`         Subject: ${subject}`);
    console.log(`         OTP: ${otp}`);
    return { delivered: true, fallback: true };
  }

  await transporter.sendMail({ from, to, subject, text, html });
  return { delivered: true, fallback: false };
};

module.exports = { sendPasswordResetEmail, sendOTPEmail };
