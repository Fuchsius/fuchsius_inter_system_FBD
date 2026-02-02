const express = require('express');
const {
    getAllAttendance,
    getAttendanceById,
    createAttendance,
    updateAttendance,
    deleteAttendance,
    checkIn,
    checkOut,
    getMyAttendance,
    getAttendanceStats,
    getTodayAttendance
} = require('../controllers/AttendanceController');
const { authenticate, authorize } = require('../auth/authMiddleware');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Get attendance statistics - Admin/HR/PM only
router.get('/stats', authenticate, authorize(['admin', 'hr', 'pm']), getAttendanceStats);

// Get all attendance - Admin/HR/PM only
router.get('/', authenticate, authorize(['admin', 'hr', 'pm']), getAllAttendance);

// Get my attendance - All authenticated users (their own attendance)
router.get('/my', authenticate, getMyAttendance);

// Get today's attendance - All authenticated users (their own today's attendance)
router.get('/today', authenticate, getTodayAttendance);

// Get attendance by ID - Admin/HR/PM or own attendance
router.get('/:id', authenticate, async (req, res, next) => {
    // Allow access if user is admin/hr/pm or it's their own attendance
    if (['admin', 'hr', 'pm'].includes(req.user.role)) {
        return getAttendanceById(req, res);
    }
    
    // Check if it's their own attendance
    try {
        const attendance = await prisma.attendance.findUnique({
            where: { id: req.params.id },
            select: { userId: true }
        });
        
        if (attendance && attendance.userId === req.user.id) {
            return getAttendanceById(req, res);
        }
        
        return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to check attendance permissions'
        });
    }
});

// Create attendance - Any authenticated user
router.post('/', authenticate, createAttendance);

// Update attendance - Any authenticated user
router.put('/:id', authenticate, updateAttendance);

// Delete attendance - Admin/PM only
router.delete('/:id', authenticate, authorize(['admin', 'pm']), deleteAttendance);

// Check in - All authenticated users
router.post('/checkin', authenticate, checkIn);

// Check out - All authenticated users
router.post('/checkout', authenticate, checkOut);

module.exports = router;