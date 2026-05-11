const { transporter } = require('../config/mail');

// Simple HTML templates. Keep them small and self-contained so they render well in most clients.
const templates = {
  otpTemplate: (otp) => `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #111;">
      <h2 style="color:#0b5fff;">Your verification code</h2>
      <p>Use the code below to complete your action. It will expire in a few minutes.</p>
      <div style="font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 16px 0;">${otp}</div>
      <p style="color:#666; font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `,

  welcomeTemplate: (name) => `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #111;">
      <h1 style="color:#0b5fff;">Welcome to Academic Debate</h1>
      <p>Hi ${name || 'there'},</p>
      <p>We're excited to have you on board. Get started by exploring debates and joining the community.</p>
      <p style="color:#666; font-size:12px;">If you have any questions, reply to this email.</p>
    </div>
  `,

  resetPasswordTemplate: (resetLink) => `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #111;">
      <h2 style="color:#0b5fff;">Reset your password</h2>
      <p>Click the button below to reset your password. This link will expire shortly.</p>
      <p style="margin: 16px 0;"><a href="${resetLink}" style="background:#0b5fff;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Reset password</a></p>
      <p style="color:#666; font-size:12px;">If you didn't request this, you can ignore this email.</p>
    </div>
  `,

  notificationTemplate: (subject, message) => `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #111;">
      <h3 style="color:#0b5fff;">${subject}</h3>
      <p>${message}</p>
    </div>
  `
};

async function sendMail({ to, subject, text, html, from }) {
  if (!transporter) {
    throw new Error('Mailer transporter is not configured');
  }

  const mailOptions = {
    from: from || process.env.EMAIL_USER,
    to,
    subject,
    text,
    html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (err) {
    // Bubble up a clear error
    const message = err && err.message ? err.message : String(err);
    throw new Error(`Failed to send email: ${message}`);
  }
}

async function sendOTPEmail(to, { otp, subject = 'Your verification code', from } = {}) {
  if (!to) throw new Error('Recipient email (to) is required for OTP email');
  const html = templates.otpTemplate(otp);
  const text = `Your verification code: ${otp}`;
  return sendMail({ to, subject, text, html, from });
}

async function sendWelcomeEmail(to, { name, subject = 'Welcome to Academic Debate', from } = {}) {
  if (!to) throw new Error('Recipient email (to) is required for welcome email');
  const html = templates.welcomeTemplate(name);
  const text = `Welcome${name ? `, ${name}` : ''}!`;
  return sendMail({ to, subject, text, html, from });
}

async function sendResetPasswordEmail(to, { resetLink, subject = 'Reset your password', from } = {}) {
  if (!to) throw new Error('Recipient email (to) is required for reset password email');
  const html = templates.resetPasswordTemplate(resetLink);
  const text = `Reset your password using this link: ${resetLink}`;
  return sendMail({ to, subject, text, html, from });
}

async function sendNotificationEmail(to, { subject = 'Notification', message = '', from } = {}) {
  if (!to) throw new Error('Recipient email (to) is required for notification email');
  const html = templates.notificationTemplate(subject, message);
  const text = message;
  return sendMail({ to, subject, text, html, from });
}

module.exports = {
  sendMail,
  sendOTPEmail,
  sendWelcomeEmail,
  sendResetPasswordEmail,
  sendNotificationEmail
};
