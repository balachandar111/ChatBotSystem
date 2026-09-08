const jwt = require("jsonwebtoken");

/**
 * Verifies the Bearer token and attaches { id, role } to req.user.
 * role is either "SUPER_ADMIN" or "ADMIN".
 */
const protect = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

module.exports = { protect };
