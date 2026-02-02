const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../auth/passwordUtils');
const { createActivityLog } = require('./ActivityController');

const prisma = new PrismaClient();

const generateEmployeeId = async () => {
    let employeeId;
    let isUnique = false;

    while (!isUnique) {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        employeeId = `EMP${timestamp}${random}`;

        const existing = await prisma.user.findFirst({
            where: { employeeId }
        });

        if (!existing) {
            isUnique = true;
        }
    }

    return employeeId;
};

const generateReferralCode = async () => {
    let referralCode;
    let isUnique = false;

    while (!isUnique) {
        const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
        referralCode = `fuchsius-${randomString}`;

        const existing = await prisma.user.findUnique({
            where: { referralCode }
        });

        if (!existing) {
            isUnique = true;
        }
    }

    return referralCode;
};

const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

// Utility functions
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validateRequiredFields = (data) => {
    const { firstName, lastName, email } = data;
    if (!firstName || !lastName || !email) {
        return { valid: false, message: 'Required fields: firstName, lastName, email' };
    }
    if (!validateEmail(email)) {
        return { valid: false, message: 'Invalid email format' };
    }
    return { valid: true };
};

const createReferralWithUser = async (req, res) => {
    try {
        // Handle both JSON and multipart form data
        const formData = req.body;
        const isMultipart = req.headers['content-type']?.includes('multipart/form-data');

        console.log('Received data type:', isMultipart ? 'multipart' : 'json');
        console.log('Form data:', formData);
        if (req.file) console.log('Uploaded file:', req.file.filename);

        // Validate authentication
        const referredByUserId = req.user?.id;
        if (!referredByUserId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated or invalid user data'
            });
        }

        // Extract and validate form data
        const {
            firstName,
            lastName,
            email,
            phoneNumber,
            paidAmount,
            university,
            address,
            status = 'pending',
            roleId,
            positionId,
            departmentId,
            generatePassword: shouldGeneratePassword = false
        } = formData;

        // Validate required fields
        const validation = validateRequiredFields({ firstName, lastName, email });
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: validation.message
            });
        }

        // Validate pay slip file
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Pay slip file is required'
            });
        }

        // Check if user already exists
        const normalizedEmail = email.toLowerCase().trim();
        console.log('Checking for existing user with email:', normalizedEmail);

        let existingUser;
        try {
            existingUser = await prisma.user.findFirst({
                where: { email: normalizedEmail }
            });
            console.log('Existing user found:', !!existingUser);
        } catch (dbError) {
            console.error('Database query error:', dbError);
            return res.status(500).json({
                success: false,
                message: 'Database query failed',
                error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
            });
        }

        if (existingUser) {
            // User exists, just create referral
            try {
                const existingReferral = await prisma.referral.findFirst({
                    where: {
                        referredByUserId,
                        joinedUserId: existingUser.id
                    }
                });

                if (existingReferral) {
                    return res.status(409).json({
                        success: false,
                        message: 'Referral already exists for this user'
                    });
                }

                // Prevent self-referral
                if (referredByUserId === existingUser.id) {
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot refer yourself'
                    });
                }

                const referral = await prisma.referral.create({
                    data: {
                        referredByUserId,
                        joinedUserId: existingUser.id
                    },
                    include: {
                        referredBy: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                employeeId: true
                            }
                        },
                        joinedUser: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                employeeId: true,
                                paidAmount: true
                            }
                        }
                    }
                });

                // Log activity
                createActivityLog(
                    referredByUserId,
                    'REFERRAL_CREATED',
                    'Referral',
                    referral.id,
                    `Created referral for ${firstName} ${lastName}`,
                    { email: normalizedEmail, role: roleId || 'employee' },
                    req
                );

                return res.status(201).json({
                    success: true,
                    message: 'Referral created successfully for existing user',
                    data: referral
                });
            } catch (referralError) {
                console.error('Error creating referral for existing user:', referralError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to create referral',
                    error: process.env.NODE_ENV === 'development' ? referralError.message : undefined
                });
            }
        }

        // Create new user
        try {
            console.log('Creating new user for email:', normalizedEmail);

            const [generatedEmployeeId, generatedReferralCode] = await Promise.all([
                generateEmployeeId(),
                generateReferralCode()
            ]);

            console.log('Generated IDs:', { employeeId: generatedEmployeeId, referralCode: generatedReferralCode });

            // Generate password if requested
            const shouldGenerate = shouldGeneratePassword === 'true' || shouldGeneratePassword === true;
            const generatedPassword = shouldGenerate ? generatePassword() : null;
            console.log('Password generated:', !!generatedPassword);

            const hashedPassword = generatedPassword
                ? await hashPassword(generatedPassword)
                : await hashPassword('defaultPassword123');

            // Handle payment slip file
            const paymentSlipPath = req.file ? `/uploads/${req.file.filename}` : null;
            if (paymentSlipPath) {
                console.log('Payment slip uploaded:', paymentSlipPath);
            }

            // Create user data object
            const userData = {
                employeeId: generatedEmployeeId,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: normalizedEmail,
                password: hashedPassword,
                role: roleId || 'employee',
                positionId: positionId ? parseInt(positionId) : null,
                departmentId: departmentId ? parseInt(departmentId) : null,
                address: address?.trim() || null,
                phone: phoneNumber?.trim() || null,
                university: university?.trim() || null,
                referralCode: generatedReferralCode,
                paidAmount: paidAmount ? parseFloat(paidAmount) : 0,
                status: status,
                paymentSlip: paymentSlipPath
            };

            console.log('Creating user in database...');
            const newUser = await prisma.user.create({ data: userData });
            console.log('New user created successfully:', newUser.id);

            // Create referral for the new user
            const referral = await prisma.referral.create({
                data: {
                    referredByUserId,
                    joinedUserId: newUser.id
                },
                include: {
                    referredBy: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            employeeId: true
                        }
                    },
                    joinedUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            employeeId: true,
                            paidAmount: true
                        }
                    }
                }
            });

            // Log activity
            createActivityLog(
                referredByUserId,
                'REFERRAL_CREATED',
                'Referral',
                referral.id,
                `Created referral for ${firstName} ${lastName}`,
                { email: normalizedEmail, role: roleId || 'employee' },
                req
            );

            // Prepare response data
            const responseData = {
                referral,
                user: {
                    id: newUser.id,
                    employeeId: newUser.employeeId,
                    firstName: newUser.firstName,
                    lastName: newUser.lastName,
                    email: newUser.email,
                    role: newUser.role,
                    status: newUser.status,
                    referralCode: newUser.referralCode,
                    createdAt: newUser.createdAt
                }
            };

            if (generatedPassword) {
                responseData.generatedPassword = generatedPassword;
            }

            res.status(201).json({
                success: true,
                message: 'Referral and user created successfully',
                data: responseData
            });

        } catch (userCreationError) {
            console.error('Error creating user and referral:', userCreationError);
            res.status(500).json({
                success: false,
                message: 'Failed to create referral and user',
                error: process.env.NODE_ENV === 'development' ? userCreationError.message : undefined
            });
        }
    } catch (error) {
        console.error('Create referral with user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create referral and user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getAllReferrals = async (req, res) => {
    try {
        const { page = 1, limit = 10, referredBy, search } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (referredBy) where.referredByUserId = referredBy;

        if (search) {
            where.OR = [
                {
                    referredBy: {
                        firstName: { contains: search }
                    }
                },
                {
                    referredBy: {
                        lastName: { contains: search }
                    }
                },
                {
                    referredBy: {
                        email: { contains: search }
                    }
                },
                {
                    joinedUser: {
                        firstName: { contains: search }
                    }
                },
                {
                    joinedUser: {
                        lastName: { contains: search }
                    }
                },
                {
                    joinedUser: {
                        email: { contains: search }
                    }
                }
            ];
        }

        const [referrals, total] = await Promise.all([
            prisma.referral.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                include: {
                    referredBy: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            employeeId: true,
                            referralCode: true
                        }
                    },
                    joinedUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            employeeId: true,
                            paidAmount: true,
                            status: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.referral.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                referrals,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get all referrals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch referrals',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getReferralById = async (req, res) => {
    try {
        const { id } = req.params;

        const referral = await prisma.referral.findUnique({
            where: { id },
            include: {
                referredBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        role: true
                    }
                },
                joinedUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        role: true,
                        paidAmount: true
                    }
                }
            }
        });

        if (!referral) {
            return res.status(404).json({
                success: false,
                message: 'Referral not found'
            });
        }

        res.json({
            success: true,
            data: referral
        });
    } catch (error) {
        console.error('Get referral by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch referral',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const createReferral = async (req, res) => {
    try {
        const { joinedUserId } = req.body;
        const referredByUserId = req.user.id; // Current user is the referrer

        if (!joinedUserId) {
            return res.status(400).json({
                success: false,
                message: 'Joined user ID is required'
            });
        }

        // Check if joined user exists
        const joinedUser = await prisma.user.findUnique({
            where: { id: joinedUserId }
        });

        if (!joinedUser) {
            return res.status(404).json({
                success: false,
                message: 'Joined user not found'
            });
        }

        // Check if referral already exists
        const existingReferral = await prisma.referral.findFirst({
            where: {
                referredByUserId,
                joinedUserId
            }
        });

        if (existingReferral) {
            return res.status(409).json({
                success: false,
                message: 'Referral already exists for this user'
            });
        }

        // Prevent self-referral
        if (referredByUserId === joinedUserId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot refer yourself'
            });
        }

        const referral = await prisma.referral.create({
            data: {
                referredByUserId,
                joinedUserId
            },
            include: {
                referredBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true
                    }
                },
                joinedUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        paidAmount: true
                    }
                }
            }
        });

        // Log activity
        createActivityLog(
            referredByUserId,
            'REFERRAL_CREATED',
            'Referral',
            referral.id,
            `Created referral for ${joinedUser.firstName} ${joinedUser.lastName}`,
            { joinedUserId },
            req
        );

        res.status(201).json({
            success: true,
            message: 'Referral created successfully',
            data: referral
        });
    } catch (error) {
        console.error('Create referral error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create referral',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const createReferralByAdmin = async (req, res) => {
    try {
        const { joinedUserId, referredByUserId } = req.body;

        if (!joinedUserId || !referredByUserId) {
            return res.status(400).json({
                success: false,
                message: 'Both joined user ID and referred by user ID are required'
            });
        }

        // Check if both users exist
        const [joinedUser, referredByUser] = await Promise.all([
            prisma.user.findUnique({
                where: { id: joinedUserId }
            }),
            prisma.user.findUnique({
                where: { id: referredByUserId }
            })
        ]);

        if (!joinedUser) {
            return res.status(404).json({
                success: false,
                message: 'Joined user not found'
            });
        }

        if (!referredByUser) {
            return res.status(404).json({
                success: false,
                message: 'Referred by user not found'
            });
        }

        // Check if referral already exists
        const existingReferral = await prisma.referral.findFirst({
            where: {
                referredByUserId,
                joinedUserId
            }
        });

        if (existingReferral) {
            return res.status(409).json({
                success: false,
                message: 'Referral already exists for this user combination'
            });
        }

        // Prevent self-referral
        if (referredByUserId === joinedUserId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot create self-referral'
            });
        }

        const referral = await prisma.referral.create({
            data: {
                referredByUserId,
                joinedUserId
            },
            include: {
                referredBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true
                    }
                },
                joinedUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        paidAmount: true
                    }
                }
            }
        });

        // Log activity
        createActivityLog(
            req.user.id,
            'REFERRAL_CREATED_ADMIN',
            'Referral',
            referral.id,
            `Admin created referral for ${joinedUser.firstName} ${joinedUser.lastName}`,
            { referredByUserId, joinedUserId },
            req
        );

        res.status(201).json({
            success: true,
            message: 'Referral created successfully by admin',
            data: referral
        });
    } catch (error) {
        console.error('Create referral by admin error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create referral',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const updateReferral = async (req, res) => {
    try {
        const { id } = req.params;
        const { withdrawAmount } = req.body;

        // Check if referral exists
        const existingReferral = await prisma.referral.findUnique({
            where: { id }
        });

        if (!existingReferral) {
            return res.status(404).json({
                success: false,
                message: 'Referral not found'
            });
        }

        const updateData = {};
        if (withdrawAmount !== undefined) updateData.withdrawAmount = withdrawAmount;

        const updatedReferral = await prisma.referral.update({
            where: { id },
            data: updateData,
            include: {
                referredBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true
                    }
                },
                joinedUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        paidAmount: true
                    }
                }
            }
        });

        // Log activity
        createActivityLog(
            req.user.id,
            'REFERRAL_UPDATED',
            'Referral',
            updatedReferral.id,
            null, // description will be generated automatically
            { withdrawAmount },
            req,
            {
                withdrawAmount: existingReferral.withdrawAmount
            },
            {
                withdrawAmount: updatedReferral.withdrawAmount
            }
        );

        res.json({
            success: true,
            message: 'Referral updated successfully',
            data: updatedReferral
        });
    } catch (error) {
        console.error('Update referral error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update referral',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const deleteReferral = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if referral exists
        const referral = await prisma.referral.findUnique({
            where: { id }
        });

        if (!referral) {
            return res.status(404).json({
                success: false,
                message: 'Referral not found'
            });
        }

        await prisma.referral.delete({
            where: { id }
        });

        // Log activity
        createActivityLog(
            req.user.id,
            'REFERRAL_DELETED',
            'Referral',
            id,
            `Deleted referral for ${referral.joinedUser.firstName} ${referral.joinedUser.lastName}`,
            { joinedUserId: referral.joinedUserId },
            req
        );

        res.json({
            success: true,
            message: 'Referral deleted successfully'
        });
    } catch (error) {
        console.error('Delete referral error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete referral',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getMyReferrals = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
        const userId = req.user.id;

        const where = { referredByUserId: userId };

        const [referrals, total] = await Promise.all([
            prisma.referral.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                include: {
                    joinedUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            employeeId: true,
                            createdAt: true,
                            status: true,
                            paidAmount: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.referral.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                referrals,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get my referrals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your referrals',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getReferralStats = async (req, res) => {
    try {
        const [
            totalReferrals,
            referralsByStatus,
            totalPaidAmount
        ] = await Promise.all([
            prisma.referral.count(),
            prisma.referral.groupBy({
                by: ['createdAt'],
                _count: { createdAt: true }
            }),
            prisma.referral.aggregate({
                where: { withdrawAmount: { not: null } },
                _sum: { withdrawAmount: true }
            })
        ]);

        res.json({
            success: true,
            data: {
                totalReferrals,
                referralsByStatus: referralsByStatus.map(item => ({
                    date: item.createdAt,
                    count: item._count.createdAt
                })),
                totalPaidAmount: totalPaidAmount._sum.withdrawAmount || 0
            }
        });
    } catch (error) {
        console.error('Get referral stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch referral statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getAllReferrals,
    getReferralById,
    createReferral,
    createReferralWithUser,
    createReferralByAdmin,
    updateReferral,
    deleteReferral,
    getMyReferrals,
    getReferralStats
};