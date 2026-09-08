const express = require("express");
const router = express.Router();

const { loginSuperAdmin, loginAdmin } = require("../controllers/authController");

router.post("/superadmin/login", loginSuperAdmin);
router.post("/admin/login", loginAdmin);

module.exports = router;
