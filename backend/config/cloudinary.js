const cloudinary = require("cloudinary").v2;

/*
|--------------------------------------------------------------------------
| Cloudinary config
|--------------------------------------------------------------------------
| Reads credentials from .env:
|   CLOUDINARY_CLOUD_NAME
|   CLOUDINARY_API_KEY
|   CLOUDINARY_API_SECRET
|
| Used to store: chatbot product-node images (uploaded by the Admin while
| building a flow) and customer-submitted attachments/files coming from a
| dynamic form node (uploaded by the public/end user filling the bot).
*/
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

module.exports = cloudinary;
