const Product = require("../models/Product");

/*
|--------------------------------------------------------------------------
| POST /api/products
|--------------------------------------------------------------------------
*/
exports.createProduct = async (req, res) => {
  try {
    const { name, description, image } = req.body;

    const product = await Product.create({
      admin: req.user.id,
      name,
      description,
      image,
    });

    res.status(201).json({ success: true, message: "Product created", data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/products
|--------------------------------------------------------------------------
*/
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({ admin: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| PUT /api/products/:id
|--------------------------------------------------------------------------
*/
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, admin: req.user.id },
      req.body,
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, message: "Product updated", data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE /api/products/:id
|--------------------------------------------------------------------------
*/
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, admin: req.user.id });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.status(200).json({ success: true, message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
