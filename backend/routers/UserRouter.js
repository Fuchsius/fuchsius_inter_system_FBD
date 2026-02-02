const express = require('express');
const {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    changePassword,
    getUserStats
} = require('../controllers/UserController');
const { authenticate, authorize } = require('../auth/authMiddleware');
const { uploadUserFiles } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.get('/stats', authenticate, authorize(['admin', 'hr']), getUserStats);

router.get('/', authenticate, authorize(['admin', 'hr', 'pm']), getAllUsers);

router.post('/', authenticate, authorize(['admin', 'hr']), uploadUserFiles, createUser);

router.get('/:id', authenticate, async (req, res, next) => {
    if (['admin', 'hr', 'pm'].includes(req.user.role) || req.user.id === req.params.id) {
        return getUserById(req, res);
    }
    return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
    });
});

router.put('/:id', authenticate, uploadUserFiles, async (req, res, next) => {
    if (['admin', 'hr'].includes(req.user.role)) {
        return updateUser(req, res);
    }

    if (req.user.id === req.params.id) {
        const allowedFields = ['firstName', 'lastName', 'address', 'phone', 'avatar'];
        const allowedFileFields = ['avatar'];
        const requestedFields = Object.keys(req.body);
        const requestedFileFields = req.files ? Object.keys(req.files) : [];
        
        const hasRestrictedFields = requestedFields.some(field => !allowedFields.includes(field));
        const hasRestrictedFileFields = requestedFileFields.some(field => !allowedFileFields.includes(field));

        if (hasRestrictedFields || hasRestrictedFileFields) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your personal information'
            });
        }

        return updateUser(req, res);
    }

    return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
    });
});

router.delete('/:id', authenticate, authorize(['admin']), deleteUser);

router.patch('/:id/password', authenticate, async (req, res, next) => {
    if (req.user.role === 'admin' || req.user.id === req.params.id) {
        return changePassword(req, res);
    }

    return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
    });
});

module.exports = router;