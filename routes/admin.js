const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Order = require("../models/Order");

const router = express.Router();
const SECRET_KEY = "MY_SUPER_SECRET_KEY"; // you can move this to .env

// Hardcoded admin (change with database later)
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123";

// --------------------- Admin Login ---------------------
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign({ admin: true, username }, SECRET_KEY, {
      expiresIn: "1d",
    });

    return res.json({ success: true, token });
  }

  res.json({ success: false, message: "Invalid admin credentials" });
});

// --------------------- Admin Middleware ---------------------
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token)
    return res.status(401).json({ message: "Admin token required" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err || !user.admin)
      return res.status(403).json({ message: "Invalid admin token" });

    req.admin = user;
    next();
  });
};

// --------------------- Get All Users ---------------------
router.get("/users", authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// --------------------- Get All Orders ---------------------
router.get("/orders", authenticateAdmin, async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// --------------------- Admin Dashboard Stats ---------------------
router.get("/stats", authenticateAdmin, async (req, res) => {
  try {
    const [totalUsers, totalOrders, orders] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Order.find({}).sort({ createdAt: -1 }).limit(5),
    ]);

    const totalRevenue = orders.reduce(
      (sum, order) => sum + (order.total || 0),
      0
    );

    res.json({
      totalUsers,
      totalOrders,
      totalRevenue,
      recentOrders: orders,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch stats", error: err.message });
  }
});

// --------------------- Update Order Status ---------------------
router.put("/orders/:orderId/status", authenticateAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const { orderId } = req.params;

    const validStatuses = ["Pending", "Approved", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!order) return res.json({ message: "Order not found" });

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed", error: err.message });
  }
});

// --------------------- Delete User ---------------------
router.delete("/users/:id", authenticateAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);

    res.json({ success: true });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Failed to delete user" });
  }
});

module.exports = router;
