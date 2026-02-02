const { PrismaClient } = require('@prisma/client');
const { createActivityLog } = require('./ActivityController');

const prisma = new PrismaClient();

const getAllPositions = async (req, res) => {
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

    const [positions, total] = await Promise.all([
      prisma.position.findMany({
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
      prisma.position.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        positions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all positions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch positions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getPositionById = async (req, res) => {
  try {
    const { id } = req.params;

    const position = await prisma.position.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }

    res.json({
      success: true,
      data: position
    });
  } catch (error) {
    console.error('Get position by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch position',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const createPosition = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Position name is required'
      });
    }

    // Check if position name already exists
    const existingPosition = await prisma.position.findUnique({
      where: { name }
    });

    if (existingPosition) {
      return res.status(409).json({
        success: false,
        message: 'Position with this name already exists'
      });
    }

    const position = await prisma.position.create({
      data: {
        name,
        description: description || null
      }
    });

    // Log activity
    createActivityLog(
      req.user.id,
      'POSITION_CREATED',
      'Position',
      position.id,
      `Created position: ${name}`,
      { name, description },
      req
    );

    res.status(201).json({
      success: true,
      message: 'Position created successfully',
      data: position
    });
  } catch (error) {
    console.error('Create position error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create position',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updatePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Check if position exists
    const existingPosition = await prisma.position.findUnique({
      where: { id }
    });

    if (!existingPosition) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }

    // Check if name is being changed and if it's already taken
    if (name && name !== existingPosition.name) {
      const nameExists = await prisma.position.findUnique({
        where: { name }
      });

      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: 'Position name already exists'
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const updatedPosition = await prisma.position.update({
      where: { id },
      data: updateData
    });

    // Log activity
    createActivityLog(
      req.user.id,
      'POSITION_UPDATED',
      'Position',
      updatedPosition.id,
      null, // description will be generated automatically
      { name, description },
      req,
      {
        name: existingPosition.name,
        description: existingPosition.description
      },
      {
        name: updatedPosition.name,
        description: updatedPosition.description
      }
    );

    res.json({
      success: true,
      message: 'Position updated successfully',
      data: updatedPosition
    });
  } catch (error) {
    console.error('Update position error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update position',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const deletePosition = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if position exists
    const position = await prisma.position.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }

    // Check if position has users
    if (position._count.users > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete position with associated users. Please reassign or remove users first.'
      });
    }

    await prisma.position.delete({
      where: { id }
    });

    // Log activity
    createActivityLog(
      req.user.id,
      'POSITION_DELETED',
      'Position',
      id,
      `Deleted position: ${position.name}`,
      { name: position.name },
      req
    );

    res.json({
      success: true,
      message: 'Position deleted successfully'
    });
  } catch (error) {
    console.error('Delete position error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete position',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getPositionStats = async (req, res) => {
  try {
    const [totalPositions, positionsWithUserCount] = await Promise.all([
      prisma.position.count(),
      prisma.position.findMany({
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
      totalPositions,
      positions: positionsWithUserCount.map(pos => ({
        id: pos.id,
        name: pos.name,
        userCount: pos._count.users
      }))
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get position stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch position statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllPositions,
  getPositionById,
  createPosition,
  updatePosition,
  deletePosition,
  getPositionStats
};