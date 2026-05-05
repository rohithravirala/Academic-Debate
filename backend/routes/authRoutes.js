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

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', sendOtpCode);
router.post('/verify-otp', verifyOtpCode);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/reset-password-otp', resetPasswordWithOtp);

module.exports = router;
