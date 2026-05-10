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

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', sendOtpCode);
router.post('/verify-otp', verifyOtpCode);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/reset-password-otp', resetPasswordWithOtp);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
	'/google/callback',
	passport.authenticate('google', { session: false, failureRedirect: '/login?error=true' }),
	(req, res) => {
		try {
			if (!req.user) {
				return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
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
			const userStr = encodeURIComponent(JSON.stringify(userObj));

			// Redirect to CLIENT_URL with token and user details
			res.redirect(`${process.env.CLIENT_URL}/login?token=${token}&user=${userStr}`);
		} catch (error) {
			console.error('Google callback error:', error);
			res.redirect(`${process.env.CLIENT_URL}/login?error=server_error`);
		}
	}
);

module.exports = router;
