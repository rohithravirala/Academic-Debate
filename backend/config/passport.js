const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;

        if (!email) {
          return done(new Error('No email found in Google profile'), null);
        }

        // Check if user already exists
        let user = await User.findOne({ email });

        if (!user) {
          // If not, create a new user
          user = await User.create({
            name: profile.displayName || '',
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            email: email,
            provider: 'google',
            googleId: profile.id,
            role: 'student',
            profileImage: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : '',
            avatarUrl: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : ''
          });
        } else {
          // If user exists but lacks googleId/provider, update them
          if (!user.googleId) {
            user.googleId = profile.id;
            user.provider = 'google';
            if (!user.profileImage && profile.photos && profile.photos.length > 0) {
              user.profileImage = profile.photos[0].value;
              user.avatarUrl = profile.photos[0].value;
            }
            await user.save();
          }
        }

        return done(null, user);
      } catch (error) {
        console.error('Error during Google authentication:', error);
        return done(error, null);
      }
    }
  )
);

module.exports = passport;