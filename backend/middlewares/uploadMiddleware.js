const multer = require("multer");

const storage = multer.memoryStorage();

// Excel bulk-upload for the "manual query upload" feature
const uploadExcel = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv",
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Only .xlsx, .xls, or .csv files are allowed"));
  },
});

// Generic attachment upload (image/pdf) used on the public query submission endpoint
// (kept for backward compatibility with the plain "end message" contact form)
const uploadAttachment = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Only image (jpg, png, webp, gif) or PDF files are allowed"));
  },
});

// Single image upload used by the Admin Chatbot Builder to attach a photo to
// a "product" card inside a flow node. Uploaded straight to Cloudinary
// (see controllers/chatbotController.js -> uploadNodeImage).
const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Only image files (jpg, png, webp, gif) are allowed"));
  },
});

// Background-video upload used by the Theme Setter tab (Admin uploads an
// ambient looping video played behind the whole chat window). Kept as a
// separate config from uploadImage since videos need a larger size limit
// and a different mimetype allow-list.
const uploadVideo = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Only video files (mp4, webm, ogg, mov) are allowed"));
  },
});

// Dynamic form-node submissions from the public widget: the Admin defines
// their own field keys (name, number, date, description, file, ...) per
// bot, so we don't know the field names ahead of time. upload.any() accepts
// every field — text fields land in req.body, files land in req.files.
const uploadFormFiles = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 10 }, // 8MB per file, up to 10 files
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Unsupported file type: " + file.mimetype));
  },
}).any();

module.exports = { uploadExcel, uploadAttachment, uploadImage, uploadVideo, uploadFormFiles };