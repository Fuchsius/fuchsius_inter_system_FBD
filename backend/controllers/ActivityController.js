const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ACTIVITY_LIMIT = 2000;
const ACTIVITY_TRIM_SIZE = 1;

const enforceActivityLimit = async () => {
    try {
        const totalActivities = await prisma.activity.count();
        if (totalActivities <= ACTIVITY_LIMIT) {
            return;
        }

        const oldestActivities = await prisma.activity.findMany({
            orderBy: { createdAt: 'asc' },
            take: ACTIVITY_TRIM_SIZE,
            select: { id: true }
        });

        const idsToDelete = oldestActivities.map(activity => activity.id);
        if (idsToDelete.length === 0) {
            return;
        }

        await prisma.activity.deleteMany({
            where: { id: { in: idsToDelete } }
        });

        console.log(`Trimmed ${idsToDelete.length} old activity records to enforce limit`);
    } catch (error) {
        console.error('Failed to enforce activity limit:', error);
    }
};

// Helper function to parse device information from user agent
const parseDeviceInfo = (userAgent) => {
    if (!userAgent) {
        console.log('No user agent provided');
        return null;
    }
    
    // Handle very short or incomplete user agents
    if (userAgent.length < 20) {
        console.log('User agent too short:', userAgent);
        return {
            type: 'unknown',
            os: 'unknown',
            osVersion: 'unknown',
            browser: 'unknown',
            browserVersion: 'unknown',
            deviceName: 'Incomplete User Agent'
        };
    }
    
    console.log('Parsing user agent:', userAgent.substring(0, 200));
    
    try {
        const deviceInfo = {
            type: 'unknown',
            os: 'unknown',
            osVersion: 'unknown',
            browser: 'unknown',
            browserVersion: 'unknown',
            deviceName: 'Unknown Device'
        };

        // Detect device type (mobile, tablet, desktop)
        if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
            deviceInfo.type = /iPad|Tablet/i.test(userAgent) ? 'tablet' : 'mobile';
        } else {
            deviceInfo.type = 'desktop';
        }

        // Detect operating system
        if (/Windows/i.test(userAgent)) {
            deviceInfo.os = 'Windows';
            const match = userAgent.match(/Windows NT (\d+\.\d+)/);
            if (match) deviceInfo.osVersion = match[1];
        } else if (/Mac OS X/i.test(userAgent)) {
            deviceInfo.os = 'macOS';
            const match = userAgent.match(/Mac OS X ([\d_]+)/);
            if (match) deviceInfo.osVersion = match[1].replace(/_/g, '.');
        } else if (/Macintosh|Mac/i.test(userAgent) && !/Mac OS X/i.test(userAgent)) {
            deviceInfo.os = 'macOS';
            const match = userAgent.match(/Mac OS X ([\d_]+)/);
            if (match) deviceInfo.osVersion = match[1].replace(/_/g, '.');
        } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
            deviceInfo.os = 'iOS';
            const match = userAgent.match(/OS ([\d_]+)/);
            if (match) deviceInfo.osVersion = match[1].replace(/_/g, '.');
        } else if (/Android/i.test(userAgent)) {
            deviceInfo.os = 'Android';
            const match = userAgent.match(/Android ([\d.]+)/);
            if (match) deviceInfo.osVersion = match[1];
        } else if (/Linux/i.test(userAgent)) {
            deviceInfo.os = 'Linux';
        }

        // Detect browser
        if (/Chrome/i.test(userAgent) && !/Edg|OPR/i.test(userAgent)) {
            deviceInfo.browser = 'Chrome';
            const match = userAgent.match(/Chrome\/([\d.]+)/);
            if (match) deviceInfo.browserVersion = match[1];
        } else if (/Firefox/i.test(userAgent)) {
            deviceInfo.browser = 'Firefox';
            const match = userAgent.match(/Firefox\/([\d.]+)/);
            if (match) deviceInfo.browserVersion = match[1];
        } else if (/Safari/i.test(userAgent) && !/Chrome|Chromium|Edg|OPR/i.test(userAgent)) {
            deviceInfo.browser = 'Safari';
            const match = userAgent.match(/Version\/([\d.]+)/);
            if (match) deviceInfo.browserVersion = match[1];
        } else if (/Edg/i.test(userAgent)) {
            deviceInfo.browser = 'Edge';
            const match = userAgent.match(/Edg\/([\d.]+)/);
            if (match) deviceInfo.browserVersion = match[1];
        } else if (/Opera|OPR/i.test(userAgent)) {
            deviceInfo.browser = 'Opera';
            const match = userAgent.match(/(?:Opera|OPR)\/([\d.]+)/);
            if (match) deviceInfo.browserVersion = match[1];
        }

        // Extract device name from user agent
        let deviceName = 'Unknown Device';
        
        // For mobile devices, try to extract phone model
        if (deviceInfo.type === 'mobile') {
            const mobileMatch = userAgent.match(/(iPhone|iPad|Android|BlackBerry|Nokia|Samsung|Moto|LG|HTC|Sony|Xiaomi|Huawei|OnePlus|OPPO|Vivo|Realme|Pixel|Honor)/);
            if (mobileMatch) {
                deviceName = mobileMatch[1];
            } else {
                deviceName = 'Mobile Device';
            }
        }
        
        // For desktop, try to extract computer name or use OS + browser
        if (deviceInfo.type === 'desktop') {
            // Try to get hostname from user agent if available
            const hostnameMatch = userAgent.match(/([A-Za-z0-9-]+(?:-PC|-Laptop|-Desktop|-Computer))/);
            if (hostnameMatch) {
                deviceName = hostnameMatch[1];
            } else {
                // Fallback to OS + Browser combination, but handle unknown values
                const osName = deviceInfo.os !== 'unknown' ? deviceInfo.os : 'Unknown OS';
                const browserName = deviceInfo.browser !== 'unknown' ? deviceInfo.browser : 'Unknown Browser';
                deviceName = `${osName} ${browserName}`;
            }
        }

        // For tablets
        if (deviceInfo.type === 'tablet') {
            const tabletMatch = userAgent.match(/(iPad|Tablet|Android.*Tablet)/);
            if (tabletMatch) {
                deviceName = tabletMatch[1];
            } else {
                deviceName = 'Tablet Device';
            }
        }

        deviceInfo.deviceName = deviceName;
        
        console.log('Parsed device info:', deviceInfo);
        
        return deviceInfo;
    } catch (error) {
        console.error('Error parsing device info:', error);
        return {
            type: 'unknown',
            os: 'unknown',
            osVersion: 'unknown',
            browser: 'unknown',
            browserVersion: 'unknown',
            deviceName: 'Unknown Device'
        };
    }
};

// Helper function to get the real client IP address
const getClientIP = (req) => {
    try {
        // Check for forwarded headers (most important - set by proxies/load balancers)
        let ip = req.headers['x-forwarded-for'] ||
                 req.headers['x-real-ip'] ||
                 req.headers['x-client-ip'] ||
                 req.headers['cf-connecting-ip'] ||
                 req.headers['x-cluster-client-ip'] ||
                 req.headers['x-forwarded'] ||
                 req.headers['forwarded-for'] ||
                 req.headers['forwarded'];

        // If it's a comma-separated list, take the first one (original client)
        if (ip && typeof ip === 'string' && ip.includes(',')) {
            ip = ip.split(',')[0].trim();
        }

        // If still no IP from headers, try Express req.ip (set by trust proxy)
        if (!ip && req.ip) {
            ip = req.ip;
        }

        // Fallback to connection remote address
        if (!ip) {
            ip = req.connection?.remoteAddress ||
                 req.socket?.remoteAddress ||
                 req.connection?.socket?.remoteAddress;
        }

        // Handle IPv4-mapped IPv6 addresses (::ffff:192.168.1.1)
        if (ip && ip.startsWith('::ffff:')) {
            ip = ip.substring(7);
        }

        // Handle IPv6 loopback
        if (ip === '::1') {
            ip = '127.0.0.1';
        }

        // Remove IPv6 brackets if present
        if (ip && ip.startsWith('[') && ip.endsWith(']')) {
            ip = ip.slice(1, -1);
        }

        // In development, if we get localhost, try to get a meaningful IP
        if (process.env.NODE_ENV !== 'production' && (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost')) {
            // For development, we can show localhost since that's the client
            return '127.0.0.1 (localhost)';
        }

        // For production or external IPs, filter out private networks
        if (process.env.NODE_ENV === 'production' && (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip?.startsWith('192.168.') || ip?.startsWith('10.') || ip?.startsWith('172.'))) {
            // Don't log private/local IPs in production
            return null;
        }

        // Basic IP validation
        if (!ip) {
            return null;
        }

        return ip;
    } catch (error) {
        console.error('Error extracting client IP:', error);
        return null;
    }
};

const logActivity = async (req, res) => {
    try {
        const { action, entityType, entityId, description, metadata } = req.body;
        const userId = req.user.id;
        
        // Get IP address and user agent from request
        const ipAddress = getClientIP(req);
        const userAgent = req.headers['user-agent'];
        
        // Parse device information from user agent
        const deviceInfo = parseDeviceInfo(userAgent);
        
        // Merge device info into metadata (keep for backward compatibility)
        const enhancedMetadata = {
            ...metadata,
            device: deviceInfo
        };

        const activity = await prisma.activity.create({
            data: {
                userId,
                action,
                entityType: entityType || null,
                entityId: entityId || null,
                description: description || null,
                metadata: enhancedMetadata ? JSON.stringify(enhancedMetadata) : null,
                ipAddress: ipAddress || null,
                userAgent: userAgent || null,
                deviceType: deviceInfo?.type || null,
                os: deviceInfo?.os || null,
                osVersion: deviceInfo?.osVersion || null,
                browser: deviceInfo?.browser || null,
                browserVersion: deviceInfo?.browserVersion || null,
                deviceName: deviceInfo?.deviceName || null
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

        enforceActivityLimit();

        res.status(201).json({
            success: true,
            message: 'Activity logged successfully',
            data: activity
        });
    } catch (error) {
        console.error('Log activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to log activity',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getAllActivities = async (req, res) => {
    try {
        const { page = 1, limit = 10, userId, action, entityType, startDate, endDate, date, search } = req.query;
        const skip = (page - 1) * limit;

        // Build where conditions - if search is provided, use OR logic for search across multiple fields
        let where = {};

        if (search) {
            // Search in description field only for now
            where = {
                description: { contains: search }
            };
        } else {
            // Use original simple filtering when no search
            if (userId) where.userId = userId;
            if (action) where.action = { contains: action };
            if (entityType) where.entityType = entityType;

            // Handle date filtering separately
            if (date) {
                const startOfDay = new Date(date);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(date);
                endOfDay.setHours(23, 59, 59, 999);

                where.createdAt = {
                    gte: startOfDay,
                    lte: endOfDay
                };
            } else if (startDate && endDate) {
                where.createdAt = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            } else if (startDate) {
                where.createdAt = {
                    gte: new Date(startDate)
                };
            } else if (endDate) {
                where.createdAt = {
                    lte: new Date(endDate)
                };
            }
        }

        const [activities, total] = await Promise.all([
            prisma.activity.findMany({
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
            prisma.activity.count({ where })
        ]);

        // Parse metadata for each activity with error handling
        const activitiesWithParsedMetadata = activities.map(activity => {
            try {
                return {
                    ...activity,
                    metadata: activity.metadata ? JSON.parse(activity.metadata) : null
                };
            } catch (error) {
                console.error('Error parsing metadata:', error);
                return {
                    ...activity,
                    metadata: null
                };
            }
        });

        res.json({
            success: true,
            data: {
                activities: activitiesWithParsedMetadata,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all activities error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activities',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getActivityById = async (req, res) => {
    try {
        const { id } = req.params;

        const activity = await prisma.activity.findUnique({
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

        if (!activity) {
            return res.status(404).json({
                success: false,
                message: 'Activity not found'
            });
        }

        // Parse metadata with error handling
        let parsedMetadata = null;
        if (activity.metadata) {
            try {
                parsedMetadata = JSON.parse(activity.metadata);
            } catch (error) {
                console.warn(`Failed to parse metadata for activity ${activity.id}:`, error);
                parsedMetadata = null;
            }
        }
        const activityWithParsedMetadata = {
            ...activity,
            metadata: parsedMetadata
        };

        res.json({
            success: true,
            data: activityWithParsedMetadata
        });
    } catch (error) {
        console.error('Get activity by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activity',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getMyActivities = async (req, res) => {
    try {
        const { page = 1, limit = 10, action, entityType, startDate, endDate } = req.query;
        const skip = (page - 1) * limit;
        const userId = req.user.id;

        const where = { userId };
        if (action) where.action = { contains: action };
        if (entityType) where.entityType = entityType;
        
        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        } else if (startDate) {
            where.createdAt = {
                gte: new Date(startDate)
            };
        } else if (endDate) {
            where.createdAt = {
                lte: new Date(endDate)
            };
        }

        const [activities, total] = await Promise.all([
            prisma.activity.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.activity.count({ where })
        ]);

        // Parse metadata for each activity with error handling
        const activitiesWithParsedMetadata = activities.map(activity => {
            try {
                return {
                    ...activity,
                    metadata: activity.metadata ? JSON.parse(activity.metadata) : null
                };
            } catch (error) {
                console.error('Error parsing metadata:', error);
                return {
                    ...activity,
                    metadata: null
                };
            }
        });

        res.json({
            success: true,
            data: {
                activities: activitiesWithParsedMetadata,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get my activities error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your activities',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const deleteActivity = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if activity exists
        const activity = await prisma.activity.findUnique({
            where: { id }
        });

        if (!activity) {
            return res.status(404).json({
                success: false,
                message: 'Activity not found'
            });
        }

        await prisma.activity.delete({
            where: { id }
        });

        res.json({
            success: true,
            message: 'Activity deleted successfully'
        });
    } catch (error) {
        console.error('Delete activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete activity',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getActivityStats = async (req, res) => {
    try {
        const { userId, startDate, endDate } = req.query;
        const where = {};
        if (userId) where.userId = userId;
        
        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        const [
            totalActivities,
            todayActivities,
            thisWeekActivities,
            thisMonthActivities,
            activitiesByAction,
            activitiesByEntityType,
            activitiesByUser,
            recentActivities
        ] = await Promise.all([
            prisma.activity.count({ where }),
            // Today's activities
            prisma.activity.count({ 
                where: { 
                    ...where,
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                        lt: new Date(new Date().setHours(23, 59, 59, 999))
                    }
                }
            }),
            // This week's activities (Monday to Sunday)
            prisma.activity.count({ 
                where: { 
                    ...where,
                    createdAt: {
                        gte: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + (new Date().getDay() === 0 ? -6 : 1))),
                        lt: new Date(new Date().setDate(new Date().getDate() + (7 - new Date().getDay())))
                    }
                }
            }),
            // This month's activities
            prisma.activity.count({ 
                where: { 
                    ...where,
                    createdAt: {
                        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                        lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
                    }
                }
            }),
            prisma.activity.groupBy({
                by: ['action'],
                _count: { action: true },
                where,
                orderBy: { _count: { action: 'desc' } },
                take: 10
            }),
            prisma.activity.groupBy({
                by: ['entityType'],
                _count: { entityType: true },
                where: { entityType: { not: null }, ...where },
                orderBy: { _count: { entityType: 'desc' } }
            }),
            prisma.activity.groupBy({
                by: ['userId'],
                _count: { userId: true },
                where,
                orderBy: { _count: { userId: 'desc' } },
                take: 10
            }),
            prisma.activity.findMany({
                where,
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 10
            })
        ]);

        // Get user details for user stats
        const userIds = activitiesByUser.map(item => item.userId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                employeeId: true
            }
        });

        const activitiesByUserWithDetails = activitiesByUser.map(item => {
            const user = users.find(u => u.id === item.userId);
            return {
                user,
                count: item._count.userId
            };
        });

        res.json({
            success: true,
            data: {
                totalActivities,
                todayActivities,
                thisWeekActivities,
                thisMonthActivities,
                activitiesByAction: activitiesByAction.map(item => ({
                    action: item.action,
                    count: item._count.action
                })),
                activitiesByEntityType: activitiesByEntityType.map(item => ({
                    entityType: item.entityType,
                    count: item._count.entityType
                })),
                activitiesByUser: activitiesByUserWithDetails,
                recentActivities: recentActivities.map(activity => {
                    let parsedMetadata = null;
                    if (activity.metadata) {
                        try {
                            parsedMetadata = JSON.parse(activity.metadata);
                        } catch (error) {
                            console.warn(`Failed to parse metadata for recent activity ${activity.id}:`, error);
                            parsedMetadata = null;
                        }
                    }
                    return {
                        ...activity,
                        metadata: parsedMetadata
                    };
                })
            }
        });
    } catch (error) {
        console.error('Get activity stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activity statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Helper function to log activity (can be used by other controllers)
const createActivityLog = async (userId, action, entityType = null, entityId = null, description = null, metadata = null, req = null, oldData = null, newData = null) => {
    try {
        // Generate enhanced description if oldData and newData are provided
        let finalDescription = description;
        let finalMetadata = metadata;

        if (oldData && newData) {
            const changes = [];
            const changedFields = [];

            // Compare old and new data to find changes
            for (const key in newData) {
                if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
                    changedFields.push(key);
                    changes.push(`${key}: ${JSON.stringify(oldData[key])} → ${JSON.stringify(newData[key])}`);
                }
            }

            // Generate descriptive change summary
            if (changes.length > 0) {
                finalDescription = `Updated ${entityType?.toLowerCase()}: ${changes.join(', ')}`;
            } else {
                finalDescription = `Updated ${entityType?.toLowerCase()} (no field changes detected)`;
            }

            // Include old and new data in metadata
            finalMetadata = {
                ...metadata,
                oldData,
                newData,
                changes: changedFields,
                changeCount: changes.length
            };
        }

        const ipAddress = req ? getClientIP(req) : null;
        const userAgent = req?.headers?.['user-agent'];
        
        // Parse device information from user agent
        const deviceInfo = parseDeviceInfo(userAgent);
        
        // Merge device info into metadata (keep for backward compatibility)
        const enhancedMetadata = {
            ...finalMetadata,
            device: deviceInfo
        };

        await prisma.activity.create({
            data: {
                userId,
                action,
                entityType,
                entityId,
                description: finalDescription,
                metadata: enhancedMetadata ? JSON.stringify(enhancedMetadata) : null,
                ipAddress: ipAddress || null,
                userAgent: userAgent || null,
                deviceType: deviceInfo?.type || null,
                os: deviceInfo?.os || null,
                osVersion: deviceInfo?.osVersion || null,
                browser: deviceInfo?.browser || null,
                browserVersion: deviceInfo?.browserVersion || null,
                deviceName: deviceInfo?.deviceName || null
            }
        });

        enforceActivityLimit();
    } catch (error) {
        console.error('Failed to create activity log:', error);
        // Don't throw error to avoid breaking main functionality
    }
};

module.exports = {
    logActivity,
    getAllActivities,
    getActivityById,
    getMyActivities,
    deleteActivity,
    getActivityStats,
    createActivityLog
};