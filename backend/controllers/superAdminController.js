const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const Chatbot = require("../models/Chatbot");
const Query = require("../models/Query");
const { validateSubdomain, buildPublicLink } = require("../utils/subdomain");
const { generateQrDataUrl } = require("../utils/generateQr");

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
| GET /api/superadmin/dashboard
*/
exports.getDashboard = async (req, res) => {
  try {
    const [totalAdmins, activeAdmins, totalChatbots, publishedChatbots, totalQueries] =
      await Promise.all([
        Admin.countDocuments(),
        Admin.countDocuments({ status: "ACTIVE" }),
        Chatbot.countDocuments(),
        Chatbot.countDocuments({ status: "published" }),
        Query.countDocuments(),
      ]);

    res.status(200).json({
      success: true,
      data: {
        totalAdmins,
        activeAdmins,
        inactiveAdmins: totalAdmins - activeAdmins,
        totalChatbots,
        publishedChatbots,
        totalQueries,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| Admin Creation
|--------------------------------------------------------------------------
| POST /api/superadmin/admins
*/
exports.createAdmin = async (req, res) => {
  try {
    const { name, company, username, email, phone, password, access } = req.body;

    const existing = await Admin.findOne({ username });
    if (existing) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name,
      company,
      username,
      email,
      phone,
      password: hashedPassword,
      access: {
        chatbot: !!access?.chatbot,
        voiceChatbot: !!access?.voiceChatbot,
        manualQueryUpload: !!access?.manualQueryUpload,
      },
      createdBy: req.user.id,
    });

    const { password: _pw, ...adminData } = admin.toObject();

    res.status(201).json({ success: true, message: "Admin created", data: adminData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| List Admins (Activation Section)
|--------------------------------------------------------------------------
| GET /api/superadmin/admins
*/
exports.getAdmins = async (req, res) => {
  try {
    const admins = await Admin.find().select("-password").sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: admins.length, data: admins });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| Get single Admin
|--------------------------------------------------------------------------
| GET /api/superadmin/admins/:id
*/
exports.getAdmin = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id).select("-password");
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }
    res.status(200).json({ success: true, data: admin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| Update Admin details
|--------------------------------------------------------------------------
| PUT /api/superadmin/admins/:id
*/
exports.updateAdmin = async (req, res) => {
  try {
    const { name, company, email, phone, password } = req.body;

    const updateData = { name, company, email, phone };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const admin = await Admin.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    }).select("-password");

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    res.status(200).json({ success: true, message: "Admin updated", data: admin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| Set/clear an Admin's vanity subdomain (superadmin override)
|--------------------------------------------------------------------------
| PUT /api/superadmin/admins/:id/subdomain   body: { subdomain: "muthuwinss" }
| Same effect as the admin's own self-service PUT /api/admin/subdomain —
| exposed here too so a Superadmin can allocate/correct it directly, e.g.
| while onboarding a new client. Refreshes that admin's already-published
| chatbots' publicLink/QR immediately, same as the self-service version.
*/
exports.setAdminSubdomain = async (req, res) => {
  try {
    const { value, error } = validateSubdomain(req.body.subdomain);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    if (value) {
      const clash = await Admin.findOne({ subdomain: value, _id: { $ne: req.params.id } });
      if (clash) {
        return res.status(409).json({
          success: false,
          message: `"${value}" is already taken by another admin. Please choose another subdomain.`,
        });
      }
    }

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    admin.subdomain = value || undefined;
    await admin.save();

    const publishedBots = await Chatbot.find({ admin: admin._id, status: "published" });
    await Promise.all(
      publishedBots.map(async (bot) => {
        bot.publicLink = buildPublicLink(admin.subdomain, bot.slug);
        bot.qrCodeDataUrl = await generateQrDataUrl(bot.publicLink);
        await bot.save();
      })
    );

    const { password: _pw, ...adminData } = admin.toObject();
    res.status(200).json({
      success: true,
      message: admin.subdomain ? "Subdomain saved" : "Subdomain removed",
      data: adminData,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "That subdomain is already taken. Please choose another." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| Activation Section: Activate / Deactivate an Admin account
|--------------------------------------------------------------------------
| PUT /api/superadmin/admins/:id/status   body: { status: "ACTIVE" | "INACTIVE" }
*/
exports.setAdminStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    const admin = await Admin.findByIdAndUpdate(req.params.id, { status }, { new: true }).select(
      "-password"
    );

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    res.status(200).json({
      success: true,
      message: `Admin ${status === "ACTIVE" ? "activated" : "deactivated"}`,
      data: admin,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| Activation Section: grant/revoke feature access
|--------------------------------------------------------------------------
| PUT /api/superadmin/admins/:id/access
| body: { chatbot: true, voiceChatbot: false, manualQueryUpload: true }
*/
exports.setAdminAccess = async (req, res) => {
  try {
    const { chatbot, voiceChatbot, manualQueryUpload } = req.body;

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    if (chatbot !== undefined) admin.access.chatbot = !!chatbot;
    if (voiceChatbot !== undefined) admin.access.voiceChatbot = !!voiceChatbot;
    if (manualQueryUpload !== undefined) admin.access.manualQueryUpload = !!manualQueryUpload;

    await admin.save();

    const { password: _pw, ...adminData } = admin.toObject();

    res.status(200).json({ success: true, message: "Access updated", data: adminData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| Delete Admin
|--------------------------------------------------------------------------
| DELETE /api/superadmin/admins/:id
*/
exports.deleteAdmin = async (req, res) => {
  try {
    const admin = await Admin.findByIdAndDelete(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }
    res.status(200).json({ success: true, message: "Admin deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};