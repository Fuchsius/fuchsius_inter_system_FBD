const express = require('express');
const {
    getAllNotifications,
    getNotificationById,
    createNotification,
    updateNotification,
    deleteNotification,
    getMyNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    getNotificationStats
} = require('../controllers/NotificationController');
const { authenticate, authorize } = require('../auth/authMiddleware');

const router = express.Router();

// Get notification statistics - Admin/HR only
router.get('/stats', authenticate, authorize(['admin', 'hr']), getNotificationStats);

// Get all notifications - Admin/HR only
router.get('/', authenticate, authorize(['admin', 'hr']), getAllNotifications);

// Get my notifications - All authenticated users (their own notifications)
router.get('/my', authenticate, getMyNotifications);

// Get unread count - All authenticated users
router.get('/unread-count', authenticate, getUnreadCount);

// Get notification by ID - Admin/HR or owner
router.get('/:id', authenticate, async (req, res, next) => {
    // Allow access if user is admin/hr
    if (['admin', 'hr'].includes(req.user.role)) {
        return getNotificationById(req, res);
    }
    
    // Check if user owns the notification
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
        const notification = await prisma.notification.findUnique({
            where: { id: req.params.id },
            select: { userId: true }
        });
        
        if (notification && notification.userId === req.user.id) {
            return getNotificationById(req, res);
        }
        
        return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to check notification permissions'
        });
    }
});

// Create notification - Admin/HR/PM only
router.post('/', authenticate, authorize(['admin', 'hr', 'pm']), createNotification);

// Update notification - Admin/HR only
router.put('/:id', authenticate, authorize(['admin', 'hr']), updateNotification);

// Delete notification - Admin/HR only
router.delete('/:id', authenticate, authorize(['admin', 'hr']), deleteNotification);

// Mark as read - Owner only
router.patch('/:id/read', authenticate, markAsRead);

// Mark all as read - All authenticated users (their own notifications)
router.patch('/mark-all-read', authenticate, markAllAsRead);

module.exports = router;