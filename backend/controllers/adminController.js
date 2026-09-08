const Chatbot = require("../models/Chatbot");
const Query = require("../models/Query");
const Product = require("../models/Product");

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
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
