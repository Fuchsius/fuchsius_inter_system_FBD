const express = require('express');
const {
    logActivity,
    getAllActivities,
    getActivityById,
    getMyActivities,
    deleteActivity,
    getActivityStats,
    createActivityLog
} = require('../controllers/ActivityController');
const { authenticate, authorize } = require('../auth/authMiddleware');

const router = express.Router();

// Get activity statistics - Admin/HR only
router.get('/stats', authenticate, authorize(['admin', 'hr']), getActivityStats);

// Get all activities - Admin/HR only
router.get('/', authenticate, authorize(['admin', 'hr']), getAllActivities);

// Get my activities - All authenticated users (their own activities)
router.get('/my', authenticate, getMyActivities);

// Get activity by ID - Admin/HR or owner
router.get('/:id', authenticate, async (req, res, next) => {
    // Allow access if user is admin/hr
    if (['admin', 'hr'].includes(req.user.role)) {
        return getActivityById(req, res);
    }

    // Check if user owns the activity
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    try {
        const activity = await prisma.activity.findUnique({
            where: { id: req.params.id },
            select: { userId: true }
        });

        if (activity && activity.userId === req.user.id) {
            return getActivityById(req, res);
        }

        return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to check activity permissions'
        });
    }
});

// Log activity - Any authenticated user
router.post('/', authenticate, logActivity);

// Delete activity - Admin only
router.delete('/:id', authenticate, authorize(['admin']), deleteActivity);

module.exports = router;