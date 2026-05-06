const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTPSession = require('../models/OTPSession');
const { normalizeWhitespace, splitFullName, composeFullName } = require('../utils/nameUtils');
const { sendPasswordResetEmail, sendOTPEmail } = require('../utils/mailer');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '1d'
  });

const resolveClientURL = () => {
  const explicit = normalizeWhitespace(process.env.CLIENT_URL);
  if (explicit) return explicit;

  const fromList = normalizeWhitespace(process.env.CLIENT_URLS || '')
    .split(',')
    .map((entry) => normalizeWhitespace(entry))
    .find(Boolean);

  return fromList || 'http://localhost:5173';
};

const normalizeRole = (role) => {
  if (role === 'moderator') return 'moderator';
  if (role === 'other') return 'other';
  if (role === 'professional') return 'professional';
  return 'student';
};

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const generateOTP = () => String(Math.floor(100000 + Math.random() * 900000));

const signOTPToken = ({ email, purpose }) =>
  jwt.sign({ email, purpose, otpVerified: true }, process.env.JWT_SECRET, { expiresIn: '10m' });

const validatePurpose = (purpose) => purpose === 'signup' || purpose === 'forgot_password';

const sendOtpCode = async (req, res) => {
  try {
    const normalizedEmail = normalizeWhitespace(req.body?.email).toLowerCase();
    const purpose = normalizeWhitespace(req.body?.purpose);

    if (!normalizedEmail || !validatePurpose(purpose)) {
      return res.status(400).json({ message: 'Valid email and purpose are required' });
    }

    if (purpose === 'signup') {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(409).json({ message: 'Email already registered' });
      }
    }

    if (purpose === 'forgot_password') {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (!existingUser) {
        return res.status(404).json({ message: 'User not found' });
      }
    }

    const existingSession = await OTPSession.findOne({ email: normalizedEmail, purpose });
    if (existingSession) {
      const cooldownRemaining = OTP_COOLDOWN_MS - (Date.now() - new Date(existingSession.lastSentAt).getTime());
      if (cooldownRemaining > 0) {
        return res.status(429).json({
          message: `Please wait ${Math.ceil(cooldownRemaining / 1000)} seconds before resending OTP`,
          retryAfter: Math.ceil(cooldownRemaining / 1000)
        });
      }
    }

    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await OTPSession.findOneAndUpdate(
      { email: normalizedEmail, purpose },
      {
        $set: {
          otpHash,
          expiresAt,
          lastSentAt: new Date(),
          attempts: 0,
          verifiedAt: null
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const deliveryResult = await sendOTPEmail({ to: normalizedEmail, otp, purpose });

    if (!deliveryResult?.delivered) {
      return res.status(500).json({
        message:
          'OTP email was not delivered. Please check SMTP configuration (host/service, port, username, password, and sender).'
      });
    }

    return res.status(200).json({
      message: 'OTP sent successfully',
      expiresIn: 300
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send OTP', error: error.message });
  }
};

const verifyOtpCode = async (req, res) => {
  try {
    const normalizedEmail = normalizeWhitespace(req.body?.email).toLowerCase();
    const purpose = normalizeWhitespace(req.body?.purpose);
    const otp = normalizeWhitespace(req.body?.otp);

    if (!normalizedEmail || !validatePurpose(purpose) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: 'Valid email, purpose and 6-digit OTP are required' });
    }

    const session = await OTPSession.findOne({ email: normalizedEmail, purpose });
    if (!session) {
      return res.status(400).json({ message: 'OTP not found. Please request a new one.' });
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      await OTPSession.deleteOne({ _id: session._id });
      return res.status(400).json({ message: 'OTP expired. Please resend OTP.' });
    }

    if (session.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many invalid attempts. Please resend OTP.' });
    }

    const matches = await bcrypt.compare(otp, session.otpHash);
    if (!matches) {
      session.attempts += 1;
      await session.save();
      return res.status(400).json({
        message: 'Invalid OTP',
        attemptsLeft: Math.max(0, MAX_OTP_ATTEMPTS - session.attempts)
      });
    }

    session.verifiedAt = new Date();
    session.attempts = 0;
    await session.save();

    return res.status(200).json({
      message: 'OTP verified successfully',
      otpToken: signOTPToken({ email: normalizedEmail, purpose })
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify OTP', error: error.message });
  }
};

const register = async (req, res) => {
  try {
    const { name, firstName, middleName, lastName, email, password, role, profileImage, avatarUrl, otpToken } = req.body;

    if ((!name && !firstName) || !email || !password) {
      return res.status(400).json({ message: 'Name (or first name), email and password are required' });
    }

    const normalizedEmail = normalizeWhitespace(email).toLowerCase();

    if (!otpToken) {
      return res.status(400).json({ message: 'OTP verification is required before signup' });
    }

    let otpPayload;
    try {
      otpPayload = jwt.verify(otpToken, process.env.JWT_SECRET);
    } catch (_error) {
      return res.status(401).json({ message: 'Invalid or expired OTP verification token' });
    }

    if (!otpPayload?.otpVerified || otpPayload?.purpose !== 'signup' || otpPayload?.email !== normalizedEmail) {
      return res.status(401).json({ message: 'OTP verification is invalid for this email' });
    }
    const normalizedInputName = normalizeWhitespace(name);
    const hasSeparateNameFields = [firstName, middleName, lastName]
      .some((value) => normalizeWhitespace(value).length > 0);

    let resolvedParts = hasSeparateNameFields
      ? {
          firstName: normalizeWhitespace(firstName),
          middleName: normalizeWhitespace(middleName),
          lastName: normalizeWhitespace(lastName)
        }
      : splitFullName(normalizedInputName);

    if (!resolvedParts.firstName && normalizedInputName) {
      const parsedFromName = splitFullName(normalizedInputName);
      resolvedParts = {
        firstName: resolvedParts.firstName || parsedFromName.firstName,
        middleName: resolvedParts.middleName || parsedFromName.middleName,
        lastName: resolvedParts.lastName || parsedFromName.lastName
      };
    }

    if (!resolvedParts.firstName) {
      return res.status(400).json({ message: 'First name is required' });
    }

    const canonicalName = composeFullName(resolvedParts) || normalizedInputName;

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const normalizedRole = normalizeRole(role);

    const user = await User.create({
      name: canonicalName,
      firstName: resolvedParts.firstName,
      middleName: resolvedParts.middleName,
      lastName: resolvedParts.lastName,
      email: normalizedEmail,
      profileImage: normalizeWhitespace(profileImage || avatarUrl),
      avatarUrl: normalizeWhitespace(profileImage || avatarUrl),
      password: hashedPassword,
      role: normalizedRole
    });

    const token = signToken(user);

    await OTPSession.deleteOne({ email: normalizedEmail, purpose: 'signup' });

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points,
        profileImage: user.profileImage || user.avatarUrl || '',
        avatarUrl: user.avatarUrl || user.profileImage || ''
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: normalizeWhitespace(email).toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken(user);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points,
        profileImage: user.profileImage || user.avatarUrl || '',
        avatarUrl: user.avatarUrl || user.profileImage || ''
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const normalizedEmail = normalizeWhitespace(req.body?.email).toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (user) {
      const rawResetToken = crypto.randomBytes(32).toString('hex');
      const hashedResetToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');

      user.passwordResetToken = hashedResetToken;
      user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      const clientURL = resolveClientURL();
      const resetLink = `${clientURL}/reset-password/${rawResetToken}`;

      await sendPasswordResetEmail({
        to: user.email,
        resetLink,
        name: user.firstName || user.name || 'User'
      });
    }

    return res.status(200).json({ message: 'Reset link sent to your email' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to process forgot password request', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Reset token is required' });
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({ message: 'Password and confirm password are required' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const hashedResetToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedResetToken,
      passwordResetExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetToken = '';
    user.passwordResetExpiresAt = null;
    await user.save();

    return res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reset password', error: error.message });
  }
};

const resetPasswordWithOtp = async (req, res) => {
  try {
    const normalizedEmail = normalizeWhitespace(req.body?.email).toLowerCase();
    const { password, confirmPassword, otpToken } = req.body;

    if (!normalizedEmail || !otpToken) {
      return res.status(400).json({ message: 'Email and OTP verification token are required' });
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({ message: 'Password and confirm password are required' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    let otpPayload;
    try {
      otpPayload = jwt.verify(otpToken, process.env.JWT_SECRET);
    } catch (_error) {
      return res.status(401).json({ message: 'Invalid or expired OTP verification token' });
    }

    if (
      !otpPayload?.otpVerified ||
      otpPayload?.purpose !== 'forgot_password' ||
      otpPayload?.email !== normalizedEmail
    ) {
      return res.status(401).json({ message: 'OTP verification is invalid for this email' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetToken = '';
    user.passwordResetExpiresAt = null;
    await user.save();

    await OTPSession.deleteOne({ email: normalizedEmail, purpose: 'forgot_password' });

    return res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reset password', error: error.message });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  sendOtpCode,
  verifyOtpCode,
  resetPasswordWithOtp
};
