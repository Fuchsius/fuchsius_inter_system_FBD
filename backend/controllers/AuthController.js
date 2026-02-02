const { PrismaClient } = require('@prisma/client');
const { generateTokenPair, verifyToken } = require('../auth/jwtUtils');
const { hashPassword, comparePassword, validatePassword } = require('../auth/passwordUtils');
const { createActivityLog } = require('./ActivityController');

const prisma = new PrismaClient();

const generateEmployeeId = async () => {
  let employeeId;
  let isUnique = false;

  while (!isUnique) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    employeeId = `EMP${timestamp}${random}`;

    const existing = await prisma.user.findFirst({
      where: { employeeId }
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return employeeId;
};

const generateReferralCode = async () => {
  let referralCode;
  let isUnique = false;

  while (!isUnique) {
    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    referralCode = `fuchsius-${randomString}`;

    const existing = await prisma.user.findUnique({
      where: { referralCode }
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return referralCode;
};

const register = async (req, res) => {
  try {
    const avatarFile = req.files?.avatar?.[0] || null;
    const {
      firstName,
      lastName,
      email,
      password,
      role = 'interners',
      address,
      phone,
      nic,
      dateOfBirth,
      university
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: firstName, lastName, email, password'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password validation failed',
        errors: passwordValidation.errors
      });
    }

    // Generate unique employee ID and referral code
    const generatedEmployeeId = await generateEmployeeId();
    const generatedReferralCode = await generateReferralCode();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user data object
    const userData = {
      employeeId: generatedEmployeeId,
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role,
      status: 'pending',
      address,
      phone,
      nic,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      university,
      referralCode: generatedReferralCode
    };

    // Add avatar if provided
    if (avatarFile) {
      userData.avatar = `/uploads/${avatarFile.filename}`;
    }

    // Create user
    const user = await prisma.user.create({
      data: userData,
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        referralCode: true,
        avatar: true,
        createdAt: true
      }
    });

    // Generate tokens
    const tokens = generateTokenPair(user);

    // Log activity
    createActivityLog(
      user.id,
      'USER_REGISTERED',
      'User',
      user.id,
      `New ${role} registered: ${firstName} ${lastName}`,
      { email, role, avatar: userData.avatar },
      req
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        ...tokens
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last active timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() }
    });

    // Prepare user data for token
    const userForToken = {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId
    };

    // Generate tokens
    const tokens = generateTokenPair(userForToken);

    // Log activity
    createActivityLog(
      user.id,
      'USER_LOGIN',
      'Auth',
      null,
      `User logged in`,
      {},
      req
    );

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        ...tokens
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        employeeId: true,
        status: true
      }
    });

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const tokens = generateTokenPair(user);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: tokens
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        address: true,
        phone: true,
        nic: true,
        dateOfBirth: true,
        university: true,
        status: true,
        avatar: true,
        referralCode: true,
        paidAmount: true,
        lastActiveAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const logout = async (req, res) => {
  try {
    // Update last active timestamp
    await prisma.user.update({
      where: { id: req.user.id },
      data: { lastActiveAt: new Date() }
    });

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password validation failed',
        errors: passwordValidation.errors
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    // Log activity
    createActivityLog(
      user.id,
      'PASSWORD_CHANGED',
      'Auth',
      null,
      `User changed password`,
      {},
      req
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getProfile,
  logout,
  changePassword
};
