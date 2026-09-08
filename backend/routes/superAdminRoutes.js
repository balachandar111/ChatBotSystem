const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const {
  getDashboard,
  createAdmin,
  getAdmins,
  getAdmin,
  updateAdmin,
  setAdminStatus,
  setAdminAccess,
  deleteAdmin,
} = require("../controllers/superAdminController");

router.use(protect, authorizeRoles("SUPER_ADMIN"));

// Dashboard
router.get("/dashboard", getDashboard);

// Admin Creation
router.post("/admins", createAdmin);

// Activation Section (list + activate/deactivate + feature access)
router.get("/admins", getAdmins);
router.get("/admins/:id", getAdmin);
router.put("/admins/:id", updateAdmin);
router.put("/admins/:id/status", setAdminStatus);
router.put("/admins/:id/access", setAdminAccess);
router.delete("/admins/:id", deleteAdmin);

module.exports = router;
