const QRCode = require("qrcode");

/**
 * Returns a base64 PNG data URL for the given text/link. Stored directly on
 * the Chatbot document so no static file storage is required.
 */
const generateQrDataUrl = async (text) => {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
  });
};

/**
 * Returns a raw PNG buffer, used by the /qr.png streaming endpoint.
 */
const generateQrBuffer = async (text) => {
  return QRCode.toBuffer(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
  });
};

module.exports = { generateQrDataUrl, generateQrBuffer };
