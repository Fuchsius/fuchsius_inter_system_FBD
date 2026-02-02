const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const NOTIFICATION_LIMIT = 100;
const NOTIFICATION_TRIM_SIZE = 1;

const enforceNotificationLimit = async () => {
    try {
        const totalNotifications = await prisma.notification.count();
        if (totalNotifications <= NOTIFICATION_LIMIT) {
            return;
        }

        const oldestNotifications = await prisma.notification.findMany({
            orderBy: { createdAt: 'asc' },
            take: NOTIFICATION_TRIM_SIZE,
            select: { id: true }
        });

        const idsToDelete = oldestNotifications.map(notification => notification.id);
        if (idsToDelete.length === 0) {
            return;
        }

        await prisma.notification.deleteMany({
            where: { id: { in: idsToDelete } }
        });

        console.log(`Trimmed ${idsToDelete.length} old notifications to enforce limit`);
    } catch (error) {
        console.error('Failed to enforce notification limit:', error);
    }
};

const getAllNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 10, type, read, userId } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (type) where.type = type;
        if (read !== undefined) where.read = read === 'true';
        if (userId) where.userId = userId;

        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            employeeId: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.notification.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                notifications,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getNotificationById = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await prisma.notification.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        role: true
                    }
                }
            }
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error('Get notification by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notification',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const createNotification = async (req, res) => {
    try {
        const { title, message, type, userId } = req.body;

        if (!title || !message || !type || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Title, message, type, and user ID are required'
            });
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const notification = await prisma.notification.create({
            data: {
                title,
                message,
                type,
                userId,
                read: false
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true
                    }
                }
            }
        });

        enforceNotificationLimit();

        // Emit notification to user via Socket.IO
        const socketService = require('../services/socketService');
        socketService.emitToUser(userId, 'new_notification', notification);

        res.status(201).json({
            success: true,
            message: 'Notification created successfully',
            data: notification
        });
    } catch (error) {
        console.error('Create notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create notification',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const updateNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, message, type, read } = req.body;

        // Check if notification exists
        const existingNotification = await prisma.notification.findUnique({
            where: { id }
        });

        if (!existingNotification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (message !== undefined) updateData.message = message;
        if (type !== undefined) updateData.type = type;
        if (read !== undefined) updateData.read = read === 'true';

        const updatedNotification = await prisma.notification.update({
            where: { id },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true
                    }
                }
            }
        });

        res.json({
            success: true,
            message: 'Notification updated successfully',
            data: updatedNotification
        });
    } catch (error) {
        console.error('Update notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update notification',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if notification exists
        const notification = await prisma.notification.findUnique({
            where: { id }
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        await prisma.notification.delete({
            where: { id }
        });

        res.json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete notification',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getMyNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 10, type, read } = req.query;
        const skip = (page - 1) * limit;
        const userId = req.user.id;

        const where = { userId };
        if (type) where.type = type;
        if (read !== undefined) where.read = read === 'true';

        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.notification.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                notifications,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get my notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your notifications',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if notification exists and belongs to user
        const notification = await prisma.notification.findUnique({
            where: { id }
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        if (notification.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only mark your own notifications as read'
            });
        }

        const updatedNotification = await prisma.notification.update({
            where: { id },
            data: { read: true }
        });

        res.json({
            success: true,
            message: 'Notification marked as read',
            data: updatedNotification
        });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await prisma.notification.updateMany({
            where: {
                userId,
                read: false
            },
            data: { read: true }
        });

        res.json({
            success: true,
            message: 'All notifications marked as read',
            data: {
                count: result.count
            }
        });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark all notifications as read',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;

        const unreadCount = await prisma.notification.count({
            where: {
                userId,
                read: false
            }
        });

        res.json({
            success: true,
            data: {
                unreadCount
            }
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get unread count',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getNotificationStats = async (req, res) => {
    try {
        const { userId } = req.query;
        const where = userId ? { userId } : {};

        const [
            totalNotifications,
            readNotifications,
            unreadNotifications,
            notificationsByType
        ] = await Promise.all([
            prisma.notification.count({ where }),
            prisma.notification.count({ where: { ...where, read: true } }),
            prisma.notification.count({ where: { ...where, read: false } }),
            prisma.notification.groupBy({
                by: ['type'],
                _count: { type: true },
                where
            })
        ]);

        res.json({
            success: true,
            data: {
                totalNotifications,
                readNotifications,
                unreadNotifications,
                notificationsByType: notificationsByType.map(item => ({
                    type: item.type,
                    count: item._count.type
                }))
            }
        });
    } catch (error) {
        console.error('Get notification stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notification statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Helper function to create project assignment notification
const createProjectAssignmentNotification = async (userId, projectTitle, projectId) => {
    try {
        const notification = await prisma.notification.create({
            data: {
                title: 'Added to Project',
                message: `You have been added to the project "${projectTitle}"`,
                type: 'info',
                userId,
                read: false,
                description: `Project ID: ${projectId}`
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });

        enforceNotificationLimit();

        // Emit notification to user via Socket.IO
        const socketService = require('../services/socketService');
        socketService.emitToUser(userId, 'new_notification', notification);

        return notification;
    } catch (error) {
        console.error('Error creating project assignment notification:', error);
        throw error;
    }
};

module.exports = {
    getAllNotifications,
    getNotificationById,
    createNotification,
    updateNotification,
    deleteNotification,
    getMyNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    getNotificationStats,
    createProjectAssignmentNotification
};