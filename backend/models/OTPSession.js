const mongoose = require('mongoose');

const otpSessionSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    purpose: {
      type: String,
      required: true,
      enum: ['signup', 'forgot_password'],
      index: true
    },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, default: Date.now },
    attempts: { type: Number, default: 0 },
    verifiedAt: { type: Date, default: null }
  },
  { timestamps: true, collection: 'otp_sessions' }
);

otpSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 900 });
otpSessionSchema.index({ email: 1, purpose: 1 }, { unique: true });

module.exports = mongoose.model('OTPSession', otpSessionSchema);
