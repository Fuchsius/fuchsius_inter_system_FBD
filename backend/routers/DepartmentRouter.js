const express = require('express');
const {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getDepartmentStats
} = require('../controllers/DepartmentController');
const { authenticate, authorize } = require('../auth/authMiddleware');

const router = express.Router();

// Get department statistics - Admin/HR only
router.get('/stats', authenticate, authorize(['admin', 'hr']), getDepartmentStats);

// Get all departments - All authenticated users
router.get('/', authenticate, getAllDepartments);

// Get department by ID - All authenticated users
router.get('/:id', authenticate, getDepartmentById);

// Create department - Admin only
router.post('/', authenticate, authorize(['admin']), createDepartment);

// Update department - Admin only
router.put('/:id', authenticate, authorize(['admin']), updateDepartment);

// Delete department - Admin only
router.delete('/:id', authenticate, authorize(['admin']), deleteDepartment);

module.exports = router;