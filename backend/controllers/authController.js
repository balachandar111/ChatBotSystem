const bcrypt = require("bcryptjs");
const SuperAdmin = require("../models/SuperAdmin");
const Admin = require("../models/Admin");
const generateToken = require("../utils/generateToken");

/*
|--------------------------------------------------------------------------
| POST /api/auth/superadmin/login
|--------------------------------------------------------------------------
*/
exports.loginSuperAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const superAdmin = await SuperAdmin.findOne({ username });
    if (!superAdmin) {
      return res.status(404).json({ success: false, message: "Superadmin not found" });
    }

    if (superAdmin.status === "INACTIVE") {
      return res.status(403).json({ success: false, message: "Account deactivated" });
    }

    const isMatch = await bcrypt.compare(password, superAdmin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid password" });
    }

    const token = generateToken({ id: superAdmin._id, role: "SUPER_ADMIN" });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: superAdmin._id,
        name: superAdmin.name,
        username: superAdmin.username,
        role: "SUPER_ADMIN",
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| POST /api/auth/admin/login
|--------------------------------------------------------------------------
*/
exports.loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    if (admin.status === "INACTIVE") {
      return res.status(403).json({ success: false, message: "Account deactivated by Superadmin" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid password" });
    }

    const token = generateToken({ id: admin._id, role: "ADMIN" });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: admin._id,
        name: admin.name,
        username: admin.username,
        role: "ADMIN",
        access: admin.access,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
