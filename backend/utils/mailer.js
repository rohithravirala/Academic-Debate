const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { normalizeWhitespace } = require('./nameUtils');

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isTruthy = (value) => String(value).toLowerCase() === 'true';

let cachedTransporter = null;
let transporterVerified = false;
let resendClient = null;

const getEmailConfig = () => {
  const resendApiKey = normalizeWhitespace(process.env.RESEND_API_KEY);
  const service = normalizeWhitespace(process.env.SMTP_SERVICE);
  const host = normalizeWhitespace(process.env.SMTP_HOST);
  const port = toInt(process.env.SMTP_PORT, 587);
  const secure = isTruthy(process.env.SMTP_SECURE);
  const user = normalizeWhitespace(process.env.SMTP_USER);
  const pass = normalizeWhitespace(process.env.SMTP_PASS);
  const from = normalizeWhitespace(process.env.SMTP_FROM) || 'onboarding@resend.dev';

  return {
    resendApiKey,
    service,
    host,
    port,
    secure,
    user,
    pass,
    from,
    fallbackAllowed: isTruthy(process.env.SMTP_ALLOW_FALLBACK)
  };
};

const getTransporter = async () => {
  const config = getEmailConfig();

  // 1. Try Resend if API Key is present
  if (config.resendApiKey) {
    if (!resendClient) {
      console.log('[MAILER] Initializing Resend client...');
      resendClient = new Resend(config.resendApiKey);
    }
    return { type: 'resend', client: resendClient, from: config.from };
  }

  // 2. Try SMTP
  const hasSmtp = Boolean(config.service || config.host);
  if (hasSmtp && config.user && config.pass) {
    if (!cachedTransporter) {
      console.log(`[MAILER] Creating SMTP transporter for ${config.service || config.host}...`);
      cachedTransporter = nodemailer.createTransport(
        config.service
          ? {
              service: config.service,
              auth: { user: config.user, pass: config.pass }
            }
          : {
              host: config.host,
              port: config.port,
              secure: config.secure,
              auth: { user: config.user, pass: config.pass }
            }
      );
    }

    if (!transporterVerified) {
      try {
        console.log('[MAILER] Verifying SMTP connection...');
        await cachedTransporter.verify();
        console.log('[MAILER] SMTP connection verified successfully.');
        transporterVerified = true;
      } catch (error) {
        console.error('[MAILER] SMTP Verification Failed:', error.message);
        throw error;
      }
    }
    return { type: 'smtp', client: cachedTransporter, from: config.from };
  }

  // 3. Fallback
  if (config.fallbackAllowed) {
    console.log('[MAILER] No email provider configured. Falling back to console logging.');
    return { type: 'fallback', from: config.from };
  }

  console.error('[MAILER] Email Configuration Missing. Please set RESEND_API_KEY or SMTP credentials.');
  throw new Error('Email service not configured.');
};

const sendPasswordResetEmail = async ({ to, resetLink, name }) => {
  try {
    const { type, client, from } = await getTransporter();
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

    if (type === 'fallback') {
      console.log(`[MAILER] Fallback: Reset email for ${to} -> ${resetLink}`);
      return { delivered: true, fallback: true };
    }

    if (type === 'resend') {
      console.log(`[MAILER] Sending Reset email via Resend to ${to}...`);
      const { error } = await client.emails.send({ from, to, subject, html, text });
      if (error) throw error;
    } else {
      console.log(`[MAILER] Sending Reset email via SMTP to ${to}...`);
      await client.sendMail({ from, to, subject, text, html });
    }

    console.log(`[MAILER] Reset email sent successfully to ${to}`);
    return { delivered: true, fallback: false };
  } catch (error) {
    console.error(`[MAILER] Failed to send reset email to ${to}:`, error.message);
    return { delivered: false, fallback: false, error: error.message };
  }
};

const sendOTPEmail = async ({ to, otp, purpose }) => {
  try {
    const { type, client, from } = await getTransporter();
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

    if (type === 'fallback') {
      console.log(`[MAILER] Fallback: OTP for ${to} is ${otp}`);
      return { delivered: true, fallback: true };
    }

    if (type === 'resend') {
      console.log(`[MAILER] Sending OTP via Resend to ${to}...`);
      const { error } = await client.emails.send({ from, to, subject, html, text });
      if (error) throw error;
    } else {
      console.log(`[MAILER] Sending OTP via SMTP to ${to}...`);
      await client.sendMail({ from, to, subject, text, html });
    }

    console.log(`[MAILER] OTP email sent successfully to ${to}`);
    return { delivered: true, fallback: false };
  } catch (error) {
    console.error(`[MAILER] Failed to send OTP email to ${to}:`, error.message);
    return { delivered: false, fallback: false, error: error.message };
  }
};

module.exports = { sendPasswordResetEmail, sendOTPEmail };
