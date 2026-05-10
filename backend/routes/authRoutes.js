const express = require('express');
const {
	register,
	login,
	forgotPassword,
	resetPassword,
	sendOtpCode,
	verifyOtpCode,
	resetPasswordWithOtp
} = require('../controllers/authController');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();
const clientURL = process.env.CLIENT_URL || 'http://localhost:5173';

router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', sendOtpCode);
router.post('/verify-otp', verifyOtpCode);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/reset-password-otp', resetPasswordWithOtp);

const googleAuthCodes = new Map();
const GOOGLE_AUTH_CODE_TTL_MS = 5 * 60 * 1000;

const createGoogleAuthCode = (payload) => {
	const code = crypto.randomBytes(24).toString('hex');
	googleAuthCodes.set(code, {
		...payload,
		expiresAt: Date.now() + GOOGLE_AUTH_CODE_TTL_MS
	});
	return code;
};

const consumeGoogleAuthCode = (code) => {
	const stored = googleAuthCodes.get(code);
	if (!stored) {
		return null;
	}

	googleAuthCodes.delete(code);

	if (stored.expiresAt < Date.now()) {
		return null;
	}

	return stored;
};

setInterval(() => {
	const now = Date.now();
	for (const [code, stored] of googleAuthCodes.entries()) {
		if (stored.expiresAt < now) {
			googleAuthCodes.delete(code);
		}
	}
}, GOOGLE_AUTH_CODE_TTL_MS).unref?.();

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.post('/google/exchange', (req, res) => {
	const { code } = req.body;

	if (!code) {
		return res.status(400).json({ message: 'Google auth code is required' });
	}

	const authPayload = consumeGoogleAuthCode(code);
	if (!authPayload) {
		return res.status(401).json({ message: 'Invalid or expired Google auth code' });
	}

	return res.json({
		token: authPayload.token,
		user: authPayload.user
	});
});

router.get(
	'/google/callback', // Updated to use one-time code exchange
	passport.authenticate('google', { session: false, failureRedirect: `${clientURL}/login?error=true` }),
	(req, res) => {
		try {
			if (!req.user) {
				return res.redirect(`${clientURL}/login?error=auth_failed`);
			}

			// Generate JWT token
			const token = jwt.sign(
				{ id: req.user._id, role: req.user.role },
				process.env.JWT_SECRET,
				{ expiresIn: '30d' }
			);

			// Encode user details
			const userObj = {
				_id: req.user._id,
				name: req.user.name,
				email: req.user.email,
				role: req.user.role,
				profileImage: req.user.profileImage || req.user.avatarUrl
			};
			const authCode = createGoogleAuthCode({ token, user: userObj });

			// Redirect with a short-lived code instead of the full auth payload
			res.redirect(`${clientURL}/login?code=${authCode}`);
		} catch (error) {
			console.error('Google callback error:', error);
			res.redirect(`${clientURL}/login?error=server_error`);
		}
	}
);

module.exports = router;
