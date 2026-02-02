const express = require('express');
const {
    getAllEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    getUpcomingEvents,
    getEventStats
} = require('../controllers/EventController');
const { authenticate, authorize } = require('../auth/authMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Get event statistics - Admin/HR only
router.get('/stats', authenticate, authorize(['admin', 'hr']), getEventStats);

// Get all events - All authenticated users
router.get('/', authenticate, getAllEvents);

// Get upcoming events - All authenticated users
router.get('/upcoming', authenticate, getUpcomingEvents);

// Get event by ID - All authenticated users
router.get('/:id', authenticate, getEventById);

// Create event - Admin/HR only
router.post('/', authenticate, authorize(['admin', 'hr']), uploadSingle, createEvent);

// Update event - Admin/HR only
router.put('/:id', authenticate, authorize(['admin', 'hr']), uploadSingle, updateEvent);

// Delete event - Admin/HR only
router.delete('/:id', authenticate, authorize(['admin', 'hr']), deleteEvent);

module.exports = router;