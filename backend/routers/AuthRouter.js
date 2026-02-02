const express = require('express');
const router = express.Router();
const { authenticate } = require('../auth/authMiddleware');
const {
  register,
  login,
  refreshToken,
  getProfile,
  logout,
  changePassword
} = require('../controllers/AuthController');
const { uploadUserFiles } = require('../middleware/uploadMiddleware');

router.post('/register', uploadUserFiles, register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/profile', authenticate, getProfile);
router.post('/logout', authenticate, logout);
router.put('/change-password', authenticate, changePassword);

module.exports = router;
