const { PrismaClient } = require('@prisma/client');
const { createActivityLog } = require('./ActivityController');

const prisma = new PrismaClient();

const getSriLankaDate = () => {
    const now = new Date();
    // Convert to Sri Lanka timezone and get the date part
    const sriLankaDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
    const year = sriLankaDate.getFullYear();
    const month = String(sriLankaDate.getMonth() + 1).padStart(2, '0');
    const day = String(sriLankaDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getAllAttendance = async (req, res) => {
    try {
        const { page = 1, limit = 10, userId, date, status } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (userId) where.userId = userId;
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);
            where.date = {
                gte: startDate,
                lt: endDate
            };
        }
        
        // Filter by attendance status based on check-in/check-out times
        if (status) {
            if (status === 'present') {
                where.checkInTime = { not: null };
            } else if (status === 'absent') {
                where.checkInTime = null;
            } else if (status === 'complete') {
                where.checkInTime = { not: null };
                where.checkOutTime = { not: null };
            } else if (status === 'incomplete') {
                where.checkInTime = { not: null };
                where.checkOutTime = null;
            }
        }

        const [attendance, total] = await Promise.all([
            prisma.attendance.findMany({
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
                            employeeId: true,
                            role: true,
                            avatar: true,
                            lastActiveAt: true,
                            departmentId: true,
                            positionId: true,
                            department: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            },
                            position: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                },
                orderBy: { date: 'desc' }
            }),
            prisma.attendance.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                attendance,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance records',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getAttendanceById = async (req, res) => {
    try {
        const { id } = req.params;

        const attendance = await prisma.attendance.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        role: true,
                        lastActiveAt: true
                    }
                }
            }
        });

        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: 'Attendance record not found'
            });
        }

        res.json({
            success: true,
            data: attendance
        });
    } catch (error) {
        console.error('Get attendance by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance record',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const createAttendance = async (req, res) => {
    try {
        const { userId, date, checkInTime, checkOutTime } = req.body;

        if (!userId || !date) {
            return res.status(400).json({
                success: false,
                message: 'User ID and date are required'
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

        // Check if attendance record already exists for this user and date
        const attendanceDate = new Date(date);
        const startDate = new Date(attendanceDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(attendanceDate);
        endDate.setHours(23, 59, 59, 999);

        const existingAttendance = await prisma.attendance.findFirst({
            where: {
                userId,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });

        if (existingAttendance) {
            return res.status(409).json({
                success: false,
                message: 'Attendance record already exists for this user and date'
            });
        }

        // Validate check-out time is after check-in time
        if (checkInTime && checkOutTime) {
            const checkIn = new Date(checkInTime);
            const checkOut = new Date(checkOutTime);
            if (checkOut <= checkIn) {
                return res.status(400).json({
                    success: false,
                    message: 'Check-out time must be after check-in time'
                });
            }
        }

        const attendance = await prisma.attendance.create({
            data: {
                userId,
                date: new Date(date),
                checkInTime: checkInTime ? new Date(checkInTime) : null,
                checkOutTime: checkOutTime ? new Date(checkOutTime) : null
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        lastActiveAt: true
                    }
                }
            }
        });

        // Log activity
        createActivityLog(
            userId,
            'CREATE_ATTENDANCE',
            'Attendance',
            attendance.id,
            `Created attendance record for user ${userId}`,
            { date, checkInTime, checkOutTime },
            req
        );

        res.status(201).json({
            success: true,
            message: 'Attendance record created successfully',
            data: attendance
        });
    } catch (error) {
        console.error('Create attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create attendance record',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const updateAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, checkInTime, checkOutTime, status } = req.body;

        // Check if attendance record exists
        const existingAttendance = await prisma.attendance.findUnique({
            where: { id }
        });

        if (!existingAttendance) {
            return res.status(404).json({
                success: false,
                message: 'Attendance record not found'
            });
        }

        // Validate check-out time is after check-in time (only if both are provided)
        if (checkInTime && checkOutTime) {
            const finalCheckInTime = new Date(checkInTime);
            const finalCheckOutTime = new Date(checkOutTime);

            if (finalCheckOutTime <= finalCheckInTime) {
                return res.status(400).json({
                    success: false,
                    message: 'Check-out time must be after check-in time'
                });
            }
        }

        const updateData = {};
        if (date !== undefined) updateData.date = new Date(date);
        if (checkInTime !== undefined) updateData.checkInTime = checkInTime ? new Date(checkInTime) : null;
        if (checkOutTime !== undefined) updateData.checkOutTime = checkOutTime ? new Date(checkOutTime) : null;
        if (status !== undefined) updateData.status = status;

        const updatedAttendance = await prisma.attendance.update({
            where: { id },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        lastActiveAt: true
                    }
                }
            }
        });

        // Log activity
        createActivityLog(
            req.user.id,
            'UPDATE_ATTENDANCE',
            'Attendance',
            updatedAttendance.id,
            null, // description will be generated automatically
            { date, checkInTime, checkOutTime },
            req,
            {
                date: existingAttendance.date,
                checkInTime: existingAttendance.checkInTime,
                checkOutTime: existingAttendance.checkOutTime,
                status: existingAttendance.status
            },
            {
                date: updatedAttendance.date,
                checkInTime: updatedAttendance.checkInTime,
                checkOutTime: updatedAttendance.checkOutTime,
                status: updatedAttendance.status
            }
        );

        res.json({
            success: true,
            message: 'Attendance record updated successfully',
            data: updatedAttendance
        });
    } catch (error) {
        console.error('Update attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update attendance record',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const deleteAttendance = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if attendance record exists
        const attendance = await prisma.attendance.findUnique({
            where: { id }
        });

        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: 'Attendance record not found'
            });
        }

        await prisma.attendance.delete({
            where: { id }
        });

        // Log activity
        createActivityLog(
            req.user.id,
            'DELETE_ATTENDANCE',
            'Attendance',
            id,
            `Deleted attendance record for user ${attendance.userId}`,
            { date: attendance.date },
            req
        );

        res.json({
            success: true,
            message: 'Attendance record deleted successfully'
        });
    } catch (error) {
        console.error('Delete attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete attendance record',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const checkIn = async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        const todaySriLanka = getSriLankaDate();
        const today = new Date(todaySriLanka);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Check if already checked in today
        const existingAttendance = await prisma.attendance.findFirst({
            where: {
                userId,
                date: {
                    gte: today,
                    lt: tomorrow
                }
            }
        });

        if (existingAttendance && existingAttendance.checkInTime) {
            return res.status(409).json({
                success: false,
                message: 'Already checked in today'
            });
        }

        let attendance;
        if (existingAttendance) {
            // Update existing record with check-in time
            attendance = await prisma.attendance.update({
                where: { id: existingAttendance.id },
                data: { checkInTime: now },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            employeeId: true,
                            lastActiveAt: true
                        }
                    }
                }
            });
        } else {
            // Create new attendance record
            attendance = await prisma.attendance.create({
                data: {
                    userId,
                    date: today,
                    checkInTime: now
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            employeeId: true,
                            lastActiveAt: true
                        }
                    }
                }
            });
        }

        // Log activity
        createActivityLog(
            userId,
            'CHECK_IN',
            'Attendance',
            attendance.id,
            `Checked in at ${now}`,
            { checkInTime: now },
            req
        );

        res.status(201).json({
            success: true,
            message: 'Checked in successfully',
            data: attendance
        });
    } catch (error) {
        console.error('Check in error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check in',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const checkOut = async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();

        // Find the latest check-in without check-out (handles overnight shifts)
        const attendance = await prisma.attendance.findFirst({
            where: {
                userId,
                checkOutTime: null
            },
            orderBy: {
                checkInTime: 'desc'
            }
        });

        if (!attendance || !attendance.checkInTime) {
            return res.status(400).json({
                success: false,
                message: 'No active check-in record found'
            });
        }

        if (attendance.checkOutTime) {
            return res.status(409).json({
                success: false,
                message: 'Already checked out'
            });
        }

        const updatedAttendance = await prisma.attendance.update({
            where: { id: attendance.id },
            data: { checkOutTime: now },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        lastActiveAt: true
                    }
                }
            }
        });

        // Log activity
        createActivityLog(
            userId,
            'CHECK_OUT',
            'Attendance',
            updatedAttendance.id,
            `Checked out at ${now}`,
            { checkOutTime: now },
            req
        );

        res.json({
            success: true,
            message: 'Checked out successfully',
            data: updatedAttendance
        });
    } catch (error) {
        console.error('Check out error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check out',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getMyAttendance = async (req, res) => {
    try {
        const { page = 1, limit = 10, date, status } = req.query;
        const skip = (page - 1) * limit;
        const userId = req.user.id;

        const where = { userId };
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);
            where.date = {
                gte: startDate,
                lt: endDate
            };
        }
        
        if (status) {
            if (status === 'present') {
                where.checkInTime = { not: null };
            } else if (status === 'absent') {
                where.checkInTime = null;
            } else if (status === 'complete') {
                where.checkInTime = { not: null };
                where.checkOutTime = { not: null };
            } else if (status === 'incomplete') {
                where.checkInTime = { not: null };
                where.checkOutTime = null;
            }
        }

        const [attendance, total] = await Promise.all([
            prisma.attendance.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: { date: 'desc' }
            }),
            prisma.attendance.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                attendance,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get my attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your attendance records',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getAttendanceStats = async (req, res) => {
    try {
        const { userId, startDate, endDate } = req.query;
        const where = {};

        if (userId) where.userId = userId;
        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        const [
            totalRecords,
            presentRecords,
            completeRecords,
            incompleteRecords,
            absentRecords
        ] = await Promise.all([
            prisma.attendance.count({ where }),
            prisma.attendance.count({ where: { ...where, checkInTime: { not: null } } }),
            prisma.attendance.count({ 
                where: { 
                    ...where, 
                    checkInTime: { not: null },
                    checkOutTime: { not: null }
                } 
            }),
            prisma.attendance.count({ 
                where: { 
                    ...where, 
                    checkInTime: { not: null },
                    checkOutTime: null
                } 
            }),
            prisma.attendance.count({ where: { ...where, checkInTime: null } })
        ]);

        res.json({
            success: true,
            data: {
                totalRecords,
                presentRecords,
                absentRecords,
                completeRecords,
                incompleteRecords,
                attendanceRate: totalRecords > 0 ? ((presentRecords / totalRecords) * 100).toFixed(2) : 0
            }
        });
    } catch (error) {
        console.error('Get attendance stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getTodayAttendance = async (req, res) => {
    try {
        const userId = req.user.id;
        const todaySriLanka = getSriLankaDate();
        const today = new Date(todaySriLanka);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const attendance = await prisma.attendance.findFirst({
            where: {
                userId,
                date: {
                    gte: today,
                    lt: tomorrow
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        lastActiveAt: true
                    }
                }
            }
        });

        res.json({
            success: true,
            data: {
                attendance: attendance ? [attendance] : []
            }
        });
    } catch (error) {
        console.error('Get today attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch today\'s attendance',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
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
};