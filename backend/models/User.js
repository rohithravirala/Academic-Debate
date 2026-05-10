const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    firstName: { type: String, trim: true, default: '' },
    middleName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { 
      type: String, 
      required: function() {
        return this.provider !== 'google';
      },
      minlength: 6 
    },
    provider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String, trim: true, default: '' },
    role: { type: String, enum: ['student', 'professional', 'moderator', 'other'], default: 'student' },
    country: { type: String, trim: true, default: '' },
    phoneNumber: { type: String, trim: true, default: '' },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say', ''], default: '' },
    profileImage: { type: String, trim: true, default: '' },
    avatarUrl: { type: String, trim: true, default: '' },
    points: { type: Number, default: 0 },
    passwordResetToken: { type: String, default: '' },
    passwordResetExpiresAt: { type: Date, default: null }
  },
  { timestamps: true, collection: 'users' }
);

module.exports = mongoose.model('User', userSchema);
