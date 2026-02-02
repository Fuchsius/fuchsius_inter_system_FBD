const { PrismaClient } = require('@prisma/client');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const path = require('path');
const { createActivityLog } = require('./ActivityController');

const prisma = new PrismaClient();

// Helper function to get image URL
const getImageUrl = (filename) => {
  if (!filename) return null;
  return `/uploads/${filename}`;
};

// Helper function to parse time string
const parseTimeString = (timeString) => {
  if (!timeString || !timeString.trim()) return null;
  
  // If it's already a full datetime string, return as Date
  if (timeString.includes('T') || timeString.includes('-')) {
    return new Date(timeString);
  }
  
  // If it's time-only (HH:MM), combine with today's date
  if (timeString.match(/^\d{2}:\d{2}$/)) {
    const today = new Date();
    const [hours, minutes] = timeString.split(':');
    today.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return today;
  }
  
  // Fallback
  return new Date(timeString);
};

const getAllEvents = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, category, search, upcoming } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (status) where.status = status;
        if (category) where.category = category;
        
        if (upcoming === 'true') {
            where.date = {
                gte: new Date()
            };
        }
        
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { description: { contains: search } },
                { location: { contains: search } },
                { organizer: { contains: search } },
                { category: { contains: search } }
            ];
        }

        const [events, total] = await Promise.all([
            prisma.event.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: [
                    { date: 'desc' },
                    { time: 'desc' }
                ]
            }),
            prisma.event.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                events,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all events error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch events',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getEventById = async (req, res) => {
    try {
        const { id } = req.params;

        const event = await prisma.event.findUnique({
            where: { id }
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        res.json({
            success: true,
            data: event
        });
    } catch (error) {
        console.error('Get event by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch event',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const createEvent = async (req, res) => {
    try {
        const {
            title,
            description,
            category,
            date,
            time,
            maxAttendees,
            location,
            organizer,
            status
        } = req.body;
        
        // Handle image upload
        const imageUrl = req.file ? getImageUrl(req.file.filename) : null;
        
        console.log('CREATE - Time field value:', JSON.stringify(time)); // Debug exact value
        console.log('CREATE - Time field type:', typeof time); // Debug type

        if (!title || !date) {
            return res.status(400).json({
                success: false,
                message: 'Title and date are required'
            });
        }

        // Validate date is not in the past
        const eventDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        if (eventDate < today) {
            return res.status(400).json({
                success: false,
                message: 'Event date cannot be in the past'
            });
        }

        const event = await prisma.event.create({
            data: {
                title,
                description: description || null,
                category: category || null,
                date: new Date(date),
                time: time && time.trim() ? parseTimeString(time) : null,
                maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
                location: location || null,
                organizer: organizer || null,
                status: status || 'upcoming',
                imageUrl: imageUrl
            }
        });

        // Log activity
        createActivityLog(
            req.user.id,
            'EVENT_CREATED',
            'Event',
            event.id,
            `Created event: ${title}`,
            { title, date, location },
            req
        );

        res.status(201).json({
            success: true,
            message: 'Event created successfully',
            data: event
        });
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create event',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Update request body:', req.body); // Debug log
        console.log('Update request file:', req.file); // Debug log
        
        const {
            title,
            description,
            category,
            date,
            time,
            maxAttendees,
            location,
            organizer,
            status
        } = req.body;
        
        // Handle image upload
        const imageUrl = req.file ? getImageUrl(req.file.filename) : req.body.imageUrl;
        
        console.log('Time field value:', JSON.stringify(time)); // Debug exact value
        console.log('Time field type:', typeof time); // Debug type

        // Check if event exists
        const existingEvent = await prisma.event.findUnique({
            where: { id }
        });

        if (!existingEvent) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Validate date is not in the past (if provided)
        if (date !== undefined) {
            const eventDate = new Date(date);
            if (eventDate < new Date()) {
                return res.status(400).json({
                    success: false,
                    message: 'Event date cannot be in the past'
                });
            }
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (category !== undefined) updateData.category = category;
        if (date !== undefined) updateData.date = new Date(date);
        if (time !== undefined) updateData.time = time && time.trim() ? parseTimeString(time) : null;
        if (maxAttendees !== undefined) updateData.maxAttendees = maxAttendees ? parseInt(maxAttendees) : null;
        if (location !== undefined) updateData.location = location;
        if (organizer !== undefined) updateData.organizer = organizer;
        if (status !== undefined) updateData.status = status;
        if (req.file || imageUrl !== undefined) updateData.imageUrl = imageUrl;

        const updatedEvent = await prisma.event.update({
            where: { id },
            data: updateData
        });

        // Log activity
        createActivityLog(
            req.user.id,
            'EVENT_UPDATED',
            'Event',
            updatedEvent.id,
            null, // description will be generated automatically
            { title, description, category, date, time, maxAttendees, location, organizer, status },
            req,
            {
                title: existingEvent.title,
                description: existingEvent.description,
                category: existingEvent.category,
                date: existingEvent.date,
                time: existingEvent.time,
                maxAttendees: existingEvent.maxAttendees,
                location: existingEvent.location,
                organizer: existingEvent.organizer,
                status: existingEvent.status,
                imageUrl: existingEvent.imageUrl
            },
            {
                title: updatedEvent.title,
                description: updatedEvent.description,
                category: updatedEvent.category,
                date: updatedEvent.date,
                time: updatedEvent.time,
                maxAttendees: updatedEvent.maxAttendees,
                location: updatedEvent.location,
                organizer: updatedEvent.organizer,
                status: updatedEvent.status,
                imageUrl: updatedEvent.imageUrl
            }
        );

        res.json({
            success: true,
            message: 'Event updated successfully',
            data: updatedEvent
        });
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update event',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if event exists
        const event = await prisma.event.findUnique({
            where: { id }
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        await prisma.event.delete({
            where: { id }
        });

        // Log activity
        createActivityLog(
            req.user.id,
            'EVENT_DELETED',
            'Event',
            id,
            `Deleted event: ${event.title}`,
            { title: event.title },
            req
        );

        res.json({
            success: true,
            message: 'Event deleted successfully'
        });
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete event',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getUpcomingEvents = async (req, res) => {
    try {
        const { page = 1, limit = 10, category } = req.query;
        const skip = (page - 1) * limit;

        const where = {
            date: {
                gte: new Date()
            },
            status: 'upcoming'
        };
        
        if (category) where.category = category;

        const [events, total] = await Promise.all([
            prisma.event.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: [
                    { date: 'desc' },
                    { time: 'desc' }
                ]
            }),
            prisma.event.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                events,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get upcoming events error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch upcoming events',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getEventStats = async (req, res) => {
    try {
        const [
            totalEvents,
            upcomingEvents,
            completedEvents,
            cancelledEvents,
            eventsByCategory,
            eventsByStatus,
            thisMonthEvents
        ] = await Promise.all([
            prisma.event.count(),
            prisma.event.count({ where: { status: 'upcoming' } }),
            prisma.event.count({ where: { status: 'completed' } }),
            prisma.event.count({ where: { status: 'cancelled' } }),
            prisma.event.groupBy({
                by: ['category'],
                _count: { category: true },
                where: { category: { not: null } }
            }),
            prisma.event.groupBy({
                by: ['status'],
                _count: { status: true }
            }),
            prisma.event.count({
                where: {
                    date: {
                        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                        lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
                    }
                }
            })
        ]);

        res.json({
            success: true,
            data: {
                totalEvents,
                upcomingEvents,
                completedEvents,
                cancelledEvents,
                eventsByCategory: eventsByCategory.map(item => ({
                    category: item.category,
                    count: item._count.category
                })),
                eventsByStatus: eventsByStatus.map(item => ({
                    status: item.status,
                    count: item._count.status
                })),
                thisMonthEvents
            }
        });
    } catch (error) {
        console.error('Get event stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch event statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getAllEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    getUpcomingEvents,
    getEventStats
};