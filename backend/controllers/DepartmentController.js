const { PrismaClient } = require('@prisma/client');
const { createActivityLog } = require('./ActivityController');

const prisma = new PrismaClient();

const getAllDepartments = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } }
      ];
    }

    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              users: true
            }
          }
        }
      }),
      prisma.department.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        departments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    res.json({
      success: true,
      data: department
    });
  } catch (error) {
    console.error('Get department by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Department name is required'
      });
    }

    // Check if department name already exists
    const existingDepartment = await prisma.department.findUnique({
      where: { name }
    });

    if (existingDepartment) {
      return res.status(409).json({
        success: false,
        message: 'Department with this name already exists'
      });
    }

    const department = await prisma.department.create({
      data: {
        name,
        description: description || null
      }
    });

    // Log activity
    createActivityLog(
      req.user.id,
      'DEPARTMENT_CREATED',
      'Department',
      department.id,
      `Created department: ${name}`,
      { name, description },
      req
    );

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: department
    });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create department',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Check if department exists
    const existingDepartment = await prisma.department.findUnique({
      where: { id }
    });

    if (!existingDepartment) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if name is being changed and if it's already taken
    if (name && name !== existingDepartment.name) {
      const nameExists = await prisma.department.findUnique({
        where: { name }
      });

      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: 'Department name already exists'
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: updateData
    });

    // Log activity
    createActivityLog(
      req.user.id,
      'DEPARTMENT_UPDATED',
      'Department',
      updatedDepartment.id,
      null, // description will be generated automatically
      { name, description },
      req,
      {
        name: existingDepartment.name,
        description: existingDepartment.description
      },
      {
        name: updatedDepartment.name,
        description: updatedDepartment.description
      }
    );

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: updatedDepartment
    });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update department',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if department has users
    if (department._count.users > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete department with associated users. Please reassign or remove users first.'
      });
    }

    await prisma.department.delete({
      where: { id }
    });

    // Log activity
    createActivityLog(
      req.user.id,
      'DEPARTMENT_DELETED',
      'Department',
      id,
      `Deleted department: ${department.name}`,
      { name: department.name },
      req
    );

    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete department',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getDepartmentStats = async (req, res) => {
  try {
    const [totalDepartments, departmentsWithUserCount] = await Promise.all([
      prisma.department.count(),
      prisma.department.findMany({
        include: {
          _count: {
            select: {
              users: true
            }
          }
        },
        orderBy: { name: 'asc' }
      })
    ]);

    const stats = {
      totalDepartments,
      departments: departmentsWithUserCount.map(dept => ({
        id: dept.id,
        name: dept.name,
        userCount: dept._count.users
      }))
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get department stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentStats
};