const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN;

const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'fuchsius-system',
    audience: 'fuchsius-users'
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'fuchsius-system',
    audience: 'fuchsius-users'
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'fuchsius-system',
      audience: 'fuchsius-users'
    });
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

const generateTokenPair = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload)
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  generateTokenPair
};
