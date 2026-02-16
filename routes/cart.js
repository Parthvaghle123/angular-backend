const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart");
const jwt = require("jsonwebtoken");

const SECRET_KEY = "MY_SUPER_SECRET_KEY";

// --------------------- Middleware: Verify Token ---------------------
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
}

// --------------------- Add to Cart ---------------------
router.post("/add-to-cart", authenticateToken, async (req, res) => {
  const { productId, image, title, price } = req.body;
  const userId = req.user.id;

  try {
    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    const existingItem = cart.items.find((item) => item.productId === productId);
    if (existingItem)
      return res.status(400).json({ message: "Item already in cart" });

    cart.items.push({ productId, image, title, price, quantity: 1 });
    await cart.save();

    res.status(200).json({ message: "Item added to cart" });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
});

// --------------------- Get Cart ---------------------
router.get("/cart", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.json({ cart: [] });

    const fullCart = cart.items.map((item) => ({
      ...item._doc,
      total: item.price * item.quantity,
    }));

    res.json({ cart: fullCart });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
});

// --------------------- Update Quantity ---------------------
router.put("/update-quantity/:productId", authenticateToken, async (req, res) => {
  const { productId } = req.params;
  const { action } = req.body;
  const userId = req.user.id;

  try {
    const cart = await Cart.findOne({ userId });
    const item = cart.items.find((item) => item.productId === productId);

    if (!item)
      return res.status(404).json({ message: "Item not found" });

    if (action === "increase") item.quantity += 1;
    if (action === "decrease") item.quantity -= 1;

    if (item.quantity <= 0) {
      cart.items = cart.items.filter((i) => i.productId !== productId);
    }

    await cart.save();
    res.status(200).json({ message: "Quantity updated" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --------------------- Remove Item ---------------------
router.delete("/remove-from-cart/:productId", authenticateToken, async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.id;

  try {
    const cart = await Cart.findOne({ userId });

    cart.items = cart.items.filter((item) => item.productId !== productId);
    await cart.save();

    res.status(200).json({ message: "Item removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
