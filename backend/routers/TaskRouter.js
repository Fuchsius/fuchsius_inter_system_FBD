const express = require('express');
const {
    getAllTasks,
    getTaskById,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    getMyTasks,
    getTaskStats
} = require('../controllers/TaskController');
const { authenticate, authorize } = require('../auth/authMiddleware');

const router = express.Router();

// Get task statistics - Admin/HR/PM only
router.get('/stats', authenticate, authorize(['admin', 'hr', 'pm']), getTaskStats);

// Get all tasks - Admin/HR/PM only
router.get('/', authenticate, authorize(['admin', 'hr', 'pm']), getAllTasks);

// Get my tasks - All authenticated users (their own tasks)
router.get('/my', authenticate, getMyTasks);

// Get task by ID - Admin/HR/PM or assigned user
router.get('/:id', authenticate, async (req, res, next) => {
    // Allow access if user is admin/hr/pm
    if (['admin', 'hr', 'pm'].includes(req.user.role)) {
        return getTaskById(req, res);
    }
    
    // Check if user is assigned to the task
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
        const task = await prisma.task.findUnique({
            where: { id: req.params.id },
            select: { userId: true }
        });
        
        if (task && task.userId === req.user.id) {
            return getTaskById(req, res);
        }
        
        return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to check task permissions'
        });
    }
});

// Create task - Admin/PM only
router.post('/', authenticate, authorize(['admin', 'pm']), createTask);

// Update task - Admin/PM only
router.put('/:id', authenticate, authorize(['admin', 'pm']), updateTask);

// Update task status - Any authenticated user
router.patch('/:id/status', authenticate, updateTaskStatus);

// Delete task - Admin/PM only
router.delete('/:id', authenticate, authorize(['admin', 'pm']), deleteTask);

module.exports = router;