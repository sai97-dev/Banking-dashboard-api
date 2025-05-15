const jwt = require('jsonwebtoken');
const logger = require('../services/account-service/src/utils/logger');

/**
 * Middleware: Validate JWT Bearer token
 * Attaches decoded user payload to req.user
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    logger.warn(`Invalid token attempt: ${error.message}`);
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
};

/**
 * Middleware: Role-based access control
 * Usage: authorizeRoles('admin', 'support')
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`,
      });
    }
    next();
  };
};

module.exports = { authenticateToken, authorizeRoles };
