const express = require("express");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Order = require("../models/Order");
const Product = require("../models/Product");

const router = express.Router();

// JWT Secret
const SECRET_KEY = "MY_SUPER_SECRET_KEY";


// ===================================================================
// ============== ADMIN AUTH MIDDLEWARE (VERY IMPORTANT) =============
// ===================================================================
function authenticateAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token)
    return res.status(401).json({ message: "Access Denied. No Token Provided" });
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const isAdmin = decoded?.isAdmin ?? decoded?.admin;

    if (!isAdmin) {
      return res.status(403).json({ message: "Admin Access Required" });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(400).json({ message: "Invalid Token", error: err.message });
  }
}

// ===================================================================
// ==================== PRODUCT MANAGEMENT ============================
// ===================================================================

// PUBLIC: Get all products
router.get("/products/public", async (req, res) => {
  try {
    const { category, featured, displayOnGift, displayOnMenu } = req.query;

    let filter = { isAvailable: true };

    if (category && category !== "All") filter.category = category;
    if (featured === "true") filter.featured = true;
    if (displayOnGift === "true") filter.displayOnGift = true;
    if (displayOnMenu === "true") filter.displayOnMenu = true;

    const products = await Product.find(filter).sort({ createdAt: -1 });

    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch products", error: err.message });
  }
});

// ADMIN: Get all products
router.get("/products", authenticateAdmin, async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch products", error: err.message });
  }
});

// ADMIN: Create new product
router.post("/products", authenticateAdmin, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();

    res.status(201).json({
      success: true,
      product,
      message: "Product created successfully"
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create product", error: err.message });
  }
});

// ADMIN: Update product
router.put("/products/:id", authenticateAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    res.json({ success: true, product, message: "Product updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update product", error: err.message });
  }
});

// ADMIN: Delete product
router.delete("/products/:id", authenticateAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete product", error: err.message });
  }
});

// ADMIN: Toggle availability
router.patch("/products/:id/toggle-availability", authenticateAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    product.isAvailable = !product.isAvailable;
    await product.save();

    res.json({
      success: true,
      product,
      message: `Product ${product.isAvailable ? "Activated" : "Deactivated"}`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Toggle failed", error: err.message });
  }
});

// ADMIN: Toggle display (gift/menu)
router.patch("/products/:id/toggle-display", authenticateAdmin, async (req, res) => {
  try {
    const { displayType } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    if (displayType === "gift") {
      product.displayOnGift = !product.displayOnGift;
    } else if (displayType === "menu") {
      product.displayOnMenu = !product.displayOnMenu;
    } else {
      return res.status(400).json({ message: "Invalid display type" });
    }

    await product.save();

    res.json({
      success: true,
      product,
      message: `${displayType} display updated`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Toggle failed", error: err.message });
  }
});

module.exports = router;
