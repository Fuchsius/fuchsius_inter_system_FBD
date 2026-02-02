const { verifyToken } = require('./jwtUtils');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Authentication middleware to protect routes
 * Verifies JWT token and attaches user to request object
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = verifyToken(token);
      
      // Fetch user from database to ensure they still exist and are active
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          role: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          status: true
        }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'Account is not active'
        });
      }

      // Attach user to request object
      req.user = user;
      next();
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Allow access if user role is in allowedRoles
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions'
    });
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = verifyToken(token);
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          role: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          status: true
        }
      });

      if (user && user.status === 'active') {
        req.user = user;
      }
    } catch (tokenError) {
    }
  } catch (error) {
    console.error('Optional authentication middleware error:', error);
  }
  
  next();
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};
