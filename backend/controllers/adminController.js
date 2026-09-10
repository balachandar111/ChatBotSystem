const Admin = require("../models/Admin");
const Chatbot = require("../models/Chatbot");
const Query = require("../models/Query");
const Product = require("../models/Product");
const { validateSubdomain, buildPublicLink } = require("../utils/subdomain");
const { generateQrDataUrl } = require("../utils/generateQr");

/*
|--------------------------------------------------------------------------
| GET /api/admin/dashboard
|--------------------------------------------------------------------------
| Summary scoped to the logged-in Admin only.
*/
exports.getDashboard = async (req, res) => {
  try {
    const adminId = req.user.id;

    const [
      totalChatbots,
      publishedChatbots,
      productChatbots,
      overallChatbots,
      totalQueries,
      newQueries,
      totalProducts,
    ] = await Promise.all([
      Chatbot.countDocuments({ admin: adminId }),
      Chatbot.countDocuments({ admin: adminId, status: "published" }),
      Chatbot.countDocuments({ admin: adminId, type: "product" }),
      Chatbot.countDocuments({ admin: adminId, type: "overall" }),
      Query.countDocuments({ admin: adminId }),
      Query.countDocuments({ admin: adminId, status: "new" }),
      Product.countDocuments({ admin: adminId }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalChatbots,
        publishedChatbots,
        draftChatbots: totalChatbots - publishedChatbots,
        productChatbots,
        overallChatbots,
        totalQueries,
        newQueries,
        totalProducts,
        access: req.admin.access,
        subdomain: req.admin.subdomain || "",
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| PUT /api/admin/subdomain
|--------------------------------------------------------------------------
| Self-service: lets the logged-in Admin set (or clear) the vanity
| subdomain shared by ALL of their chatbots, e.g. "muthuwinss" ->
| https://muthuwinss.geninuety.com — each of their bots then lives at
| https://muthuwinss.geninuety.com/bot/<slug>, told apart by the existing
| /bot/:slug path exactly as before (see App.jsx's <Route path="/bot/:slug">
| — nothing about how a chatbot is chosen changes, only the hostname the
| link is shown under).
|
| body: { subdomain: "muthuwinss" } — send an empty string to remove it.
|
| Any of this Admin's ALREADY-PUBLISHED chatbots have their `publicLink` /
| QR code recomputed immediately so existing links/QRs start pointing at
| the new subdomain right away instead of only new ones.
*/
exports.updateSubdomain = async (req, res) => {
  try {
    const { value, error } = validateSubdomain(req.body.subdomain);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    if (value) {
      const clash = await Admin.findOne({ subdomain: value, _id: { $ne: req.user.id } });
      if (clash) {
        return res.status(409).json({
          success: false,
          message: `"${value}" is already taken by another admin. Please choose another subdomain.`,
        });
      }
    }

    const admin = await Admin.findById(req.user.id);
    admin.subdomain = value || undefined;
    await admin.save();

    // Refresh the public link/QR of every chatbot this admin has already
    // published, so existing links move over to the new subdomain (or back
    // to the default /bot/:slug link if the subdomain was cleared).
    const publishedBots = await Chatbot.find({ admin: req.user.id, status: "published" });
    await Promise.all(
      publishedBots.map(async (bot) => {
        bot.publicLink = buildPublicLink(admin.subdomain, bot.slug);
        bot.qrCodeDataUrl = await generateQrDataUrl(bot.publicLink);
        await bot.save();
      })
    );

    res.status(200).json({
      success: true,
      message: admin.subdomain ? "Subdomain saved" : "Subdomain removed",
      data: { subdomain: admin.subdomain || "" },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "That subdomain is already taken. Please choose another." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};