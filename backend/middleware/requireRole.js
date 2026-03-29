/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Ensures that the authenticated user has one of the required roles.
 * Must be used AFTER authenticateToken middleware.
 * 
 * @param {...string} roles - One or more allowed roles
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.get('/admin/complaints', authenticateToken, requireRole('admin'), handler);
 * router.put('/admin/complaints/:id', authenticateToken, requireRole('admin', 'authority'), handler);
 */
function requireRole(...roles) {
  return (req, res, next) => {
    // Ensure authenticateToken was called first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login first.'
      });
    }

    const userRole = req.user.role;

    // Check if user's role is in the allowed roles list
    if (!userRole || !roles.includes(userRole)) {
      console.log(`❌ Access denied: User ${req.user.id} (role: ${userRole}) attempted to access ${req.method} ${req.path}`);
      return res.status(403).json({
        success: false,
        message: `Forbidden: This endpoint requires one of the following roles: ${roles.join(', ')}. Your role: ${userRole || 'none'}.`
      });
    }

    // Role check passed, proceed to next middleware/route handler
    return next();
  };
}

module.exports = requireRole;
