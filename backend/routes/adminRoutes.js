const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");
const { loadAdmin } = require("../middlewares/accessMiddleware");

const { getDashboard, updateSubdomain } = require("../controllers/adminController");

router.use(protect, authorizeRoles("ADMIN"), loadAdmin);

router.get("/dashboard", getDashboard);
router.put("/subdomain", updateSubdomain); // set/clear the vanity subdomain shared by all of this admin's chatbots

module.exports = router;