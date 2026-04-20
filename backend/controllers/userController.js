const User = require('../models/User');
const { normalizeWhitespace, splitFullName, composeFullName } = require('../utils/nameUtils');

const MAX_PROFILE_IMAGE_BYTES = 1024 * 1024;

const getBase64ImageSize = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue.startsWith('data:')) {
    return null;
  }

  const dataUrlMatch = normalizedValue.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!dataUrlMatch) {
    return -1;
  }

  const base64Payload = dataUrlMatch[2];
  const paddingMatch = base64Payload.match(/=+$/);
  const paddingLength = paddingMatch ? paddingMatch[0].length : 0;

  return Math.floor((base64Payload.length * 3) / 4) - paddingLength;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getLeaderboard = async (req, res) => {
  try {
    const searchTerm = normalizeWhitespace(req.query.search);
    const allParam = String(req.query.all || '').toLowerCase();
    const showAll = allParam === 'true';
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 10;
    const globallyRankedUsers = await User.find({})
      .select('name firstName middleName lastName points role profileImage avatarUrl createdAt')
      .sort({ points: -1, createdAt: 1 });

    const rankByUserId = new Map(
      globallyRankedUsers.map((user, index) => [user._id.toString(), index + 1])
    );

    let filteredUsers = globallyRankedUsers;

    if (searchTerm) {
      const searchRegex = new RegExp(escapeRegex(searchTerm), 'i');
      filteredUsers = globallyRankedUsers.filter((user) =>
        [user.name, user.firstName, user.middleName, user.lastName].some((value) => searchRegex.test(String(value || '')))
      );
    }

    const usersToReturn = showAll ? filteredUsers : filteredUsers.slice(0, safeLimit);

    const leaderboardWithRanks = usersToReturn.map((user) => ({
      ...user.toObject(),
      rank: rankByUserId.get(user._id.toString()) || null
    }));

    return res.status(200).json(leaderboardWithRanks);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch leaderboard', error: error.message });
  }
};

const searchUsers = async (req, res) => {
  try {
    const queryText = normalizeWhitespace(req.query.q);
    if (!queryText) {
      return res.status(200).json([]);
    }

    const escaped = escapeRegex(queryText);
    const searchRegex = new RegExp(escaped, 'i');

    const users = await User.find({
      $or: [
        { name: searchRegex },
        { firstName: searchRegex },
        { middleName: searchRegex },
        { lastName: searchRegex }
      ]
    })
      .select('name firstName middleName lastName email role profileImage avatarUrl')
      .sort({ points: -1, createdAt: 1 })
      .limit(10);

    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to search users', error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'name firstName middleName lastName email role points country phoneNumber dateOfBirth gender profileImage avatarUrl createdAt'
    );
    if (!user) {
      return res.status(401).json({ message: 'Session expired. Please login again' });
    }

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const {
      name,
      firstName,
      middleName,
      lastName,
      email,
      country,
      phoneNumber,
      dateOfBirth,
      gender,
      role,
      profileImage,
      avatarUrl
    } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(401).json({ message: 'Session expired. Please login again' });
    }

    const parsedFromName = splitFullName(name);
    const hasFirstNameField = typeof firstName === 'string';
    const hasMiddleNameField = typeof middleName === 'string';
    const hasLastNameField = typeof lastName === 'string';

    let safeFirstName = hasFirstNameField ? normalizeWhitespace(firstName) : '';
    let safeMiddleName = hasMiddleNameField ? normalizeWhitespace(middleName) : '';
    let safeLastName = hasLastNameField ? normalizeWhitespace(lastName) : '';

    if (!hasFirstNameField && parsedFromName.firstName) {
      safeFirstName = parsedFromName.firstName;
    }
    if (!hasMiddleNameField && parsedFromName.middleName) {
      safeMiddleName = parsedFromName.middleName;
    }
    if (!hasLastNameField && parsedFromName.lastName) {
      safeLastName = parsedFromName.lastName;
    }

    if (!safeFirstName) {
      safeFirstName = normalizeWhitespace(user.firstName);
    }
    if (!safeMiddleName && !hasMiddleNameField) {
      safeMiddleName = normalizeWhitespace(user.middleName);
    }
    if (!safeLastName && !hasLastNameField) {
      safeLastName = normalizeWhitespace(user.lastName);
    }

    if (!safeFirstName) {
      const parsedFromExistingName = splitFullName(user.name);
      safeFirstName = parsedFromExistingName.firstName;
      safeMiddleName = safeMiddleName || parsedFromExistingName.middleName;
      safeLastName = safeLastName || parsedFromExistingName.lastName;
    }

    const safeEmail = normalizeWhitespace(email).toLowerCase();
    const safePhoneNumber = normalizeWhitespace(phoneNumber);

    if (!safeFirstName) {
      return res.status(400).json({ message: 'First name is required' });
    }

    if (!safeEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(safeEmail)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    const emailExists = await User.findOne({ email: safeEmail, _id: { $ne: user._id } });
    if (emailExists) {
      return res.status(409).json({ message: 'Email is already in use' });
    }

    if (safePhoneNumber && !/^\d{10}$/.test(safePhoneNumber)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    user.firstName = safeFirstName;
    user.middleName = safeMiddleName;
    user.lastName = safeLastName;
    user.email = safeEmail;
    user.name = composeFullName({
      firstName: safeFirstName,
      middleName: safeMiddleName,
      lastName: safeLastName
    }) || normalizeWhitespace(user.name);

    user.country = (country || '').trim();
    user.phoneNumber = safePhoneNumber;
    user.gender = ['male', 'female', 'other', 'prefer_not_to_say', ''].includes(gender || '') ? gender || '' : user.gender;
    if (typeof role === 'string') {
      const normalizedRole = role.trim().toLowerCase();
      const allowedRoles = ['student', 'moderator', 'other', 'professional'];
      if (!allowedRoles.includes(normalizedRole)) {
        return res.status(400).json({ message: 'Invalid role selected' });
      }
      user.role = normalizedRole;
    }
    const hasProfileImagePayload = typeof profileImage === 'string' || typeof avatarUrl === 'string';
    if (hasProfileImagePayload) {
      const normalizedProfileImage = normalizeWhitespace(profileImage || avatarUrl);

      if (normalizedProfileImage.startsWith('data:')) {
        const imageSize = getBase64ImageSize(normalizedProfileImage);
        if (imageSize < 0) {
          return res.status(400).json({ message: 'Profile image must be a valid base64 image' });
        }
        if (imageSize > MAX_PROFILE_IMAGE_BYTES) {
          return res.status(413).json({ message: 'Profile image must be 1MB or smaller' });
        }
      }

      user.profileImage = normalizedProfileImage;
      user.avatarUrl = normalizedProfileImage;
    }

    if (dateOfBirth) {
      const parsedDate = new Date(dateOfBirth);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date of birth' });
      }
      user.dateOfBirth = parsedDate;
    }

    await user.save();

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        points: user.points,
        country: user.country,
        phoneNumber: user.phoneNumber,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        profileImage: user.profileImage || user.avatarUrl || '',
        avatarUrl: user.avatarUrl
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

module.exports = { getLeaderboard, searchUsers, getProfile, updateProfile };
