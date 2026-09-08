const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");
const { loadAdmin } = require("../middlewares/accessMiddleware");

const { getDashboard } = require("../controllers/adminController");

router.use(protect, authorizeRoles("ADMIN"), loadAdmin);

router.get("/dashboard", getDashboard);

module.exports = router;
