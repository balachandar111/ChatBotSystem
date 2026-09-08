const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");
const { requireAccess } = require("../middlewares/accessMiddleware");
const { uploadExcel } = require("../middlewares/uploadMiddleware");

const { uploadQueries, downloadSampleTemplate } = require("../controllers/manualUploadController");

router.use(protect, authorizeRoles("ADMIN"), requireAccess("manualQueryUpload"));

router.get("/sample", downloadSampleTemplate);
router.post("/upload", uploadExcel.single("file"), uploadQueries);

module.exports = router;
