const { PrismaClient } = require('@prisma/client');
const { hashPassword, comparePassword, validatePassword } = require('../auth/passwordUtils');
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

const generateTemporaryPassword = (length = 10) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i += 1) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role, status, position, includeTaskCounts } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { employeeId: { contains: search } }
      ];
    }
    if (role) where.role = role;
    if (status) where.status = status;
    if (position) where.positionId = position;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        include: {
          department: true,
          position: true,
          joined: {
            select: {
              id: true,
              referredByUserId: true,
              withdrawAmount: true,
              createdAt: true
            }
          },
          referredBy: {
            select: {
              id: true,
              referredByUserId: true,
              joinedUserId: true,
              withdrawAmount: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    // Transform users to include referredBy info from the joined relation
    const usersWithReferrals = await Promise.all(
      users.map(async (user) => {
        // Find the referral record where this user is the joined user
        const referral = user.joined?.[0];
        let referredByUser = null;

        if (referral?.referredByUserId) {
          referredByUser = await prisma.user.findUnique({
            where: { id: referral.referredByUserId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              email: true
            }
          });
        }

        return {
          ...user,
          referredBy: referredByUser,
          referralCount: user.joined?.length || 0
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: usersWithReferrals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        position: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const createUser = async (req, res) => {
  try {
    const avatarFile = req.files?.avatar?.[0] || null;
    const paymentSlipFile = req.files?.paymentSlip?.[0] || null;
    const {
      firstName,
      lastName,
      email,
      role,
      address,
      phone,
      phoneNumber,
      nic,
      nicNumber,
      dateOfBirth,
      positionId,
      departmentId,
      university,
      status,
      avatar,
      paidAmount,
      paymentSlip,
      referredBy
    } = req.body;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already taken'
      });
    }

    const employeeId = await generateEmployeeId();
    const referralCode = await generateReferralCode();
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await hashPassword(temporaryPassword);

    const numericPaidAmount = paidAmount !== undefined && paidAmount !== ''
      ? parseFloat(paidAmount)
      : null;

    const userData = {
      employeeId,
      password: hashedPassword,
      referralCode,
      firstName,
      lastName,
      email,
      role: role || 'employee',
      address: address || null,
      phone: phone || phoneNumber || null,
      nic: nic || nicNumber || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      university: university || null,
      status: status || 'active',
      avatar: avatarFile ? `/uploads/${avatarFile.filename}` : (avatar || null),
      paymentSlip: paymentSlipFile ? `/uploads/${paymentSlipFile.filename}` : (paymentSlip || null)
    };

    if (numericPaidAmount !== null && !Number.isNaN(numericPaidAmount)) {
      userData.paidAmount = numericPaidAmount;
    }

    if (departmentId) {
      userData.department = {
        connect: { id: departmentId }
      };
    }

    if (positionId) {
      userData.position = {
        connect: { id: positionId }
      };
    }

    const newUser = await prisma.user.create({
      data: userData,
      include: {
        department: true,
        position: true
      }
    });

    // Log activity
    createActivityLog(
      req.user.id,
      'USER_CREATED',
      'User',
      newUser.id,
      `Created user: ${firstName} ${lastName}`,
      { email, role },
      req
    );

    // Create referral record if referredBy is provided
    if (referredBy && referredBy.trim() !== '') {
      try {
        // Check if the referredBy user exists
        const referrerUser = await prisma.user.findUnique({
          where: { id: referredBy.trim() }
        });

        if (referrerUser) {
          await prisma.referral.create({
            data: {
              referredByUserId: referredBy.trim(),
              joinedUserId: newUser.id
            }
          });
        } else {
          console.warn('ReferredBy user not found:', referredBy);
        }
      } catch (referralError) {
        console.error('Error creating referral record:', referralError);
        // Don't fail user creation if referral creation fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: newUser,
        temporaryPassword
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Debug logging
    console.log('Update user request:', {
      id,
      body: req.body,
      files: req.files,
      hasFiles: !!req.files
    });
    
    const avatarFile = req.files?.avatar?.[0] || null;
    const paymentSlipFile = req.files?.paymentSlip?.[0] || null;
    const {
      firstName,
      lastName,
      email,
      role,
      address,
      phone,
      nic,
      dateOfBirth,
      positionId,
      departmentId,
      university,
      status,
      avatar,
      phoneNumber,
      nicNumber,
      paidAmount,
      paymentSlip,
      referredBy
    } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      });

      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: 'Email is already taken'
        });
      }
    }

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined || phoneNumber !== undefined) {
      updateData.phone = phone || phoneNumber || null;
    }
    if (nic !== undefined || nicNumber !== undefined) {
      updateData.nic = nic || nicNumber || null;
    }
    if (dateOfBirth !== undefined) {
      updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }
    if (university !== undefined) updateData.university = university;
    if (status !== undefined) updateData.status = status;
    if (avatarFile) {
      updateData.avatar = `/uploads/${avatarFile.filename}`;
    } else if (avatar !== undefined) {
      updateData.avatar = avatar || null;
    }
    if (paymentSlipFile) {
      updateData.paymentSlip = `/uploads/${paymentSlipFile.filename}`;
    } else if (paymentSlip !== undefined) {
      updateData.paymentSlip = paymentSlip || null;
    }

    if (departmentId !== undefined) {
      if (departmentId) {
        updateData.department = { connect: { id: departmentId } };
      } else {
        updateData.department = { disconnect: true };
      }
    }

    if (positionId !== undefined) {
      if (positionId) {
        updateData.position = { connect: { id: positionId } };
      } else {
        updateData.position = { disconnect: true };
      }
    }

    if (paidAmount !== undefined) {
      if (paidAmount === '' || paidAmount === null) {
        updateData.paidAmount = null;
      } else {
        const numericPaidAmount = parseFloat(paidAmount);
        if (!Number.isNaN(numericPaidAmount)) {
          updateData.paidAmount = numericPaidAmount;
        }
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        department: true,
        position: true
      }
    });

    // Log activity
    createActivityLog(
      req.user.id,
      'USER_UPDATED',
      'User',
      updatedUser.id,
      null, // description will be generated automatically
      {
        firstName,
        lastName,
        email,
        role,
        address,
        phone: phone || phoneNumber,
        nic: nic || nicNumber,
        dateOfBirth,
        university,
        status,
        positionId,
        departmentId,
        paidAmount
      },
      req,
      {
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        email: existingUser.email,
        role: existingUser.role,
        address: existingUser.address,
        phone: existingUser.phone,
        nic: existingUser.nic,
        dateOfBirth: existingUser.dateOfBirth,
        university: existingUser.university,
        status: existingUser.status,
        positionId: existingUser.positionId,
        departmentId: existingUser.departmentId,
        paidAmount: existingUser.paidAmount,
        avatar: existingUser.avatar,
        paymentSlip: existingUser.paymentSlip
      },
      {
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        role: updatedUser.role,
        address: updatedUser.address,
        phone: updatedUser.phone,
        nic: updatedUser.nic,
        dateOfBirth: updatedUser.dateOfBirth,
        university: updatedUser.university,
        status: updatedUser.status,
        positionId: updatedUser.positionId,
        departmentId: updatedUser.departmentId,
        paidAmount: updatedUser.paidAmount,
        avatar: updatedUser.avatar,
        paymentSlip: updatedUser.paymentSlip
      }
    );

    // Handle referredBy changes for updates
    if (referredBy !== undefined) {
      try {
        // Check if there's an existing referral record
        const existingReferral = await prisma.referral.findFirst({
          where: { joinedUserId: id }
        });

        if (referredBy && referredBy.trim() !== '') {
          // Validate referredBy is a string (user ID)
          if (typeof referredBy !== 'string') {
            console.warn('Invalid referredBy format in update:', typeof referredBy, referredBy);
          } else {
            // Check if the referredBy user exists
            const referrerUser = await prisma.user.findUnique({
              where: { id: referredBy.trim() }
            });

            if (referrerUser) {
              // Create or update referral record
              if (existingReferral) {
                await prisma.referral.update({
                  where: { id: existingReferral.id },
                  data: {
                    referredByUserId: referredBy.trim()
                  }
                });
              } else {
                await prisma.referral.create({
                  data: {
                    referredByUserId: referredBy.trim(),
                    joinedUserId: id
                  }
                });
              }
            } else {
              console.warn('ReferredBy user not found in update:', referredBy);
            }
          }
        } else {
          // Remove referral if referredBy is cleared
          if (existingReferral) {
            await prisma.referral.delete({
              where: { id: existingReferral.id }
            });
          }
        }
      } catch (referralError) {
        console.error('Error updating referral record:', referralError);
        // Don't fail user update if referral update fails
      }
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has related records
    const [referrals, tasks, projects] = await Promise.all([
      prisma.referral.findMany({
        where: {
          OR: [
            { referredByUserId: id },
            { joinedUserId: id }
          ]
        }
      }),
      prisma.task.findMany({ where: { userId: id } }),
      prisma.project.findMany({ where: { projectManagerId: id } })
    ]);

    if (referrals.length > 0 || tasks.length > 0 || projects.length > 0) {
      // Soft delete by setting status to inactive
      await prisma.user.update({
        where: { id },
        data: { status: 'inactive' }
      });

      return res.json({
        success: true,
        message: 'User deactivated successfully due to existing relationships'
      });
    }

    // Hard delete if no relationships
    await prisma.user.delete({
      where: { id }
    });

    // Log activity
    createActivityLog(
      req.user.id,
      'USER_DELETED',
      'User',
      id,
      `Deleted user: ${user.firstName} ${user.lastName}`,
      { email: user.email },
      req
    );

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    const isAdminOverride = req.user?.role === 'admin' && req.user?.id !== id;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password is required'
      });
    }

    if (!isAdminOverride && !currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is required'
      });
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        password: true,
        status: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!isAdminOverride) {
      // Verify current password for self-service change
      const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id },
      data: { password: hashedNewPassword }
    });

    res.json({
      success: true,
      message: isAdminOverride ? 'Password reset successfully' : 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getUserStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      usersByRole,
      departments,
      recentUsers
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      }),
      prisma.department.findMany({
        include: {
          _count: { select: { users: true } }
        }
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          createdAt: true
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        usersByRole: usersByRole.map(item => ({
          role: item.role,
          count: item._count.role
        })),
        usersByDepartment: departments.map(dept => ({
          department: dept.name,
          count: dept._count.users
        })),
        recentUsers
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  getUserStats
};