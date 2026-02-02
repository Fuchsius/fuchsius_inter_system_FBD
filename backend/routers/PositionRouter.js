const express = require('express');
const {
    getAllPositions,
    getPositionById,
    createPosition,
    updatePosition,
    deletePosition,
    getPositionStats
} = require('../controllers/PositionController');
const { authenticate, authorize } = require('../auth/authMiddleware');

const router = express.Router();

// Get position statistics - Admin/HR only
router.get('/stats', authenticate, authorize(['admin', 'hr']), getPositionStats);

// Get all positions - All authenticated users
router.get('/', authenticate, getAllPositions);

// Get position by ID - All authenticated users
router.get('/:id', authenticate, getPositionById);

// Create position - Admin only
router.post('/', authenticate, authorize(['admin']), createPosition);

// Update position - Admin only
router.put('/:id', authenticate, authorize(['admin']), updatePosition);

// Delete position - Admin only
router.delete('/:id', authenticate, authorize(['admin']), deletePosition);

module.exports = router;