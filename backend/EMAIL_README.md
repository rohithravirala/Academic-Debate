# Email Service Setup

This project uses **Nodemailer** with Gmail SMTP for sending transactional emails (OTP, welcome, password reset, notifications).

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password_or_smtp_password
```

**Important:** For Gmail accounts with 2-Factor Authentication enabled, use an **App Password** instead of your account password. [Generate an App Password here](https://myaccount.google.com/apppasswords).

### Files

- `config/mail.js` — Initializes the Gmail transporter and exports `transporter` and `verifyTransporter()`
- `utils/sendMail.js` — High-level email functions (OTP, welcome, reset, notification)

## Usage

### Send OTP Email

```javascript
const { sendOTPEmail } = require('../utils/sendMail');

await sendOTPEmail('user@example.com', { otp: '123456' });
```

### Send Welcome Email

```javascript
const { sendWelcomeEmail } = require('../utils/sendMail');

await sendWelcomeEmail('user@example.com', { name: 'John Doe' });
```

### Send Password Reset Email

```javascript
const { sendResetPasswordEmail } = require('../utils/sendMail');

const resetLink = `${process.env.CLIENT_URL}/reset-password/${token}`;
await sendResetPasswordEmail('user@example.com', { resetLink });
```

### Send Custom Notification

```javascript
const { sendNotificationEmail } = require('../utils/sendMail');

await sendNotificationEmail('user@example.com', {
  subject: 'Your debate is starting soon',
  message: 'A debate you joined starts in 5 minutes.'
});
```

### Generic Send (Low-level)

```javascript
const { sendMail } = require('../utils/sendMail');

await sendMail({
  to: 'user@example.com',
  subject: 'Custom Subject',
  text: 'Plain text version',
  html: '<h1>HTML version</h1>',
  from: 'custom@sender.com' // optional; defaults to EMAIL_USER
});
```

## Error Handling

All functions throw an error if sending fails. Wrap calls in try-catch:

```javascript
try {
  await sendOTPEmail(email, { otp });
} catch (err) {
  console.error('Email failed:', err.message);
  res.status(500).json({ message: 'Failed to send email' });
}
```

## Verification (Optional)

At startup, verify the transporter is configured correctly:

```javascript
const { verifyTransporter } = require('./config/mail');

verifyTransporter().then(ok => {
  if (!ok) console.warn('Email transporter verification failed');
});
```

## Deployment

- **Vercel / Render**: Add `EMAIL_USER` and `EMAIL_PASS` environment variables in your platform settings.
- No additional setup required; the transporter works on any Node.js runtime.

## Troubleshooting

- **"Invalid login" error**: Check that `EMAIL_USER` and `EMAIL_PASS` are correct. For Gmail, use an App Password if 2FA is enabled.
- **"Connection timeout"**: Ensure your server can reach `smtp.gmail.com:587` (not blocked by firewall).
- **No EMAIL_USER/PASS set**: The mailer logs a warning but won't crash; add env vars and restart.
