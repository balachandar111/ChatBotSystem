const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");
const { requireAccess } = require("../middlewares/accessMiddleware");
const { uploadImage, uploadVideo, uploadExcel } = require("../middlewares/uploadMiddleware");

const {
  createChatbot,
  updateFlow,
  generateChatbot,
  getQrPng,
  getChatbots,
  getChatbot,
  updateChatbot,
  deleteChatbot,
  uploadNodeImage,
  uploadThemeAsset,
  uploadThemeVideo,
  updateTheme,
  downloadFlowTemplate,
  exportFlowExcel,
  importFlowExcel,
} = require("../controllers/chatbotController");

// Base access required to even open the Chatbot module.
// Voice mode is additionally gated inside the controller via access.voiceChatbot.
router.use(protect, authorizeRoles("ADMIN"), requireAccess("chatbot"));

router.post("/upload-image", uploadImage.single("image"), uploadNodeImage); // Cloudinary upload for product-node & steps-node cards
router.post("/upload-theme-asset", uploadImage.single("image"), uploadThemeAsset); // Cloudinary upload for logo / chat background image
router.post("/upload-theme-video", uploadVideo.single("video"), uploadThemeVideo); // Cloudinary upload for the ambient background video
router.get("/flow-template", downloadFlowTemplate); // downloadable starter .xlsx for the Excel-based flow builder
router.post("/", createChatbot); // create draft (choose product/overall + mode)
router.get("/", getChatbots);
router.get("/:id", getChatbot);
router.put("/:id", updateChatbot);
router.delete("/:id", deleteChatbot);

router.put("/:id/flow", updateFlow); // save the dynamic question/option tree
router.get("/:id/flow/export-excel", exportFlowExcel); // download this bot's current flow as .xlsx
router.post("/:id/flow/import-excel", uploadExcel.single("file"), importFlowExcel); // build/replace the flow from an uploaded .xlsx
router.put("/:id/theme", updateTheme); // save logo / title / colors / background for the widget
router.post("/:id/generate", generateChatbot); // publish -> link + QR + API key
router.get("/:id/qr.png", getQrPng); // download QR as PNG

module.exports = router;