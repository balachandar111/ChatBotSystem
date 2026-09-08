/**
 * Usage: authorizeRoles("SUPER_ADMIN") or authorizeRoles("SUPER_ADMIN", "ADMIN")
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access Denied" });
    }
    next();
  };
};

module.exports = { authorizeRoles };
