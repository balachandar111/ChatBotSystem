const jwt = require("jsonwebtoken");

/**
 * Sign a JWT for either a SuperAdmin or an Admin session.
 * @param {Object} payload - { id, role }
 */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

module.exports = generateToken;
