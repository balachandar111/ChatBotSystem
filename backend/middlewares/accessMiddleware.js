const Admin = require("../models/Admin");

/**
 * Ensures the logged-in Admin has been granted a specific feature by the
 * Superadmin (chatbot / voiceChatbot / manualQueryUpload). Also blocks
 * access if the account has since been deactivated.
 *
 * Usage: requireAccess("chatbot") | requireAccess("voiceChatbot") | requireAccess("manualQueryUpload")
 */
const requireAccess = (feature) => {
  return async (req, res, next) => {
    try {
      if (req.user.role !== "ADMIN") {
        // Superadmin bypasses feature gates
        return next();
      }

      const admin = await Admin.findById(req.user.id);

      if (!admin) {
        return res.status(404).json({ success: false, message: "Admin not found" });
      }

      if (admin.status === "INACTIVE") {
        return res.status(403).json({ success: false, message: "Account deactivated" });
      }

      if (!admin.access?.[feature]) {
        return res.status(403).json({
          success: false,
          message: `You do not have access to this feature: ${feature}`,
        });
      }

      req.admin = admin; // cache for downstream controllers
      next();
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };
};

/**
 * Loads the Admin document onto req.admin without gating any specific
 * feature. Use this for routes any active Admin should reach (dashboard,
 * profile, etc). Still blocks deactivated accounts.
 */
const loadAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== "ADMIN") return next();

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }
    if (admin.status === "INACTIVE") {
      return res.status(403).json({ success: false, message: "Account deactivated" });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { requireAccess, loadAdmin };
