const express = require('express');
const {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    updateProjectStatus,
    deleteProject,
    getMyProjects,
    getProjectStats
} = require('../controllers/ProjectController');
const { authenticate, authorize } = require('../auth/authMiddleware');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Get project statistics - Admin/HR/PM/Employee only
router.get('/stats', authenticate, authorize(['admin', 'hr', 'pm', 'employee']), getProjectStats);

// Get all projects - Admin/HR/PM/Interners/Employees can view
router.get('/', authenticate, authorize(['admin', 'hr', 'pm', 'interners', 'employee']), getAllProjects);

// Get my projects - All authenticated users (projects they manage)
router.get('/my', authenticate, getMyProjects);

// Get project by ID - Admin/HR/PM/Interners/Employees or project manager
router.get('/:id', authenticate, async (req, res, next) => {
    // Allow access if user is admin/hr/pm or project manager
    if (['admin', 'hr', 'pm', 'interners', 'employee'].includes(req.user.role)) {
        return getProjectById(req, res);
    }
    
    // Check if user is the project manager
    try {
        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
            select: { projectManagerId: true }
        });
        
        if (project && project.projectManagerId === req.user.id) {
            return getProjectById(req, res);
        }
        
        return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to check project permissions'
        });
    }
});

// Create project - Admin/PM only
router.post('/', authenticate, authorize(['admin', 'pm']), createProject);

// Update project - Admin/PM only
router.put('/:id', authenticate, authorize(['admin', 'pm']), updateProject);

// Update project status - Any authenticated user
router.patch('/:id/status', authenticate, updateProjectStatus);

// Delete project - Admin only
router.delete('/:id', authenticate, authorize(['admin']), deleteProject);

module.exports = router;