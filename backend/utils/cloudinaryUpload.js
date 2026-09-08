const cloudinary = require("../config/cloudinary");

/**
 * Streams an in-memory buffer (from multer's memoryStorage) straight up to
 * Cloudinary — no temp files written to disk.
 *
 * @param {Buffer} buffer       - file buffer (req.file.buffer / req.files[i].buffer)
 * @param {Object} options
 * @param {string} options.folder        - Cloudinary folder, e.g. "chatbot-products"
 * @param {string} [options.resourceType] - "image" | "raw" | "auto" (default "auto",
 *                                          so PDFs/docs from form uploads still work)
 * @returns {Promise<{url: string, publicId: string}>}
 */
function uploadBufferToCloudinary(buffer, { folder, resourceType = "auto" } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

module.exports = { uploadBufferToCloudinary };
