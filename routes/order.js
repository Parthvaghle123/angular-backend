const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { sendOrderConfirmationEmail } = require("../utils/emailService");
const Razorpay = require("razorpay");

const SECRET_KEY = "MY_SUPER_SECRET_KEY";
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

// --------------------- Generate Order ID ---------------------
async function generateOrderId() {
  const year = new Date().getFullYear();
  const lastOrder = await Order.findOne().sort({ createdAt: -1 });
  let nextSerial = 1;

  if (lastOrder && lastOrder.orderId) {
    const lastId = parseInt(lastOrder.orderId);
    const lastYear = Math.floor(lastId / 1000);
    const lastSerial = lastId % 1000;
    if (lastYear === year) nextSerial = lastSerial + 1;
  }

  const paddedSerial = nextSerial.toString().padStart(3, "0");
  return `${year}${paddedSerial}`;
}

// --------------------- CREATE RAZORPAY ORDER (for Online Payment) ---------------------
router.post("/create-razorpay-order", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0)
      return res.status(400).json({ message: "Cart is empty" });

    const amountPaise = cart.items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
      0
    ) * 100; // Razorpay expects amount in paise
    const amountRupees = Math.ceil(amountPaise / 100);
    if (amountRupees < 1)
      return res.status(400).json({ message: "Order amount must be at least ₹1" });

    const options = {
      amount: amountPaise,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    };
    const razorpayOrder = await razorpay.orders.create(options);

    res.status(200).json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to create payment order", error: err.message });
  }
});

// --------------------- VERIFY RAZORPAY PAYMENT & PLACE ORDER ---------------------
router.post("/verify-payment", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    email,
    phone,
    countryCode,
    address,
  } = req.body;

  try {
    const signBody = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(signBody)
      .digest("hex");

    if (expectedSign !== razorpay_signature)
      return res.status(400).json({ message: "Payment verification failed" });

    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0)
      return res.status(400).json({ message: "Cart is empty" });

    const user = await User.findById(userId);
    const newOrderId = await generateOrderId();

    const order = new Order({
      orderId: newOrderId,
      username: user.username,
      email: email || user.email,
      phone: phone || user.phone,
      address,
      paymentMethod: "Online Payment",
      paymentStatus: "Paid",
      transactionId: razorpay_payment_id,
      payment_details: {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      },
      items: cart.items,
    });

    await order.save();
    await Cart.findOneAndUpdate({ userId }, { items: [] });

    // Send order confirmation email (same format as design)
    sendOrderConfirmationEmail(order).catch((e) =>
      console.error("Order confirmation email failed:", e.message)
    );

    res.status(200).json({ message: "Order placed", orderId: newOrderId });
  } catch (err) {
    res.status(500).json({ message: "Order error", error: err.message });
  }
});

// --------------------- PLACE ORDER (Cash on Delivery only) ---------------------
router.post("/order", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { email, phone, address, paymentMethod } = req.body;

  if (paymentMethod === "Online Payment")
    return res.status(400).json({ message: "Use Razorpay checkout for online payment" });

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0)
      return res.status(400).json({ message: "Cart is empty" });

    const user = await User.findById(userId);
    const newOrderId = await generateOrderId();

    const order = new Order({
      orderId: newOrderId,
      username: user.username,
      email: email || user.email,
      phone: phone || user.phone,
      address,
      paymentMethod,
      paymentStatus: "Pending",
      transactionId: null,
      payment_details: {},
      items: cart.items,
    });

    await order.save();
    await Cart.findOneAndUpdate({ userId }, { items: [] });

    // Send order confirmation email (same format as design)
    sendOrderConfirmationEmail(order).catch((e) =>
      console.error("Order confirmation email failed:", e.message)
    );

    res.status(200).json({ message: "Order placed", orderId: newOrderId });
  } catch (err) {
    res.status(500).json({ message: "Order error", error: err.message });
  }
});

// --------------------- GET ALL USER ORDERS ---------------------
router.get("/orders", authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find({ email: req.user.email }).sort({
      createdAt: -1,
    });
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// --------------------- CANCEL ORDER ---------------------
router.put("/cancel/:orderId", authenticateToken, async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  try {
    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.email !== req.user.email)
      return res.status(403).json({ message: "Unauthorized" });

    if (order.status === "Cancelled")
      return res.status(400).json({ message: "Already cancelled" });

    order.status = "Cancelled";
    order.cancelReason = reason;

    order.items.forEach((item) => {
      item.status = "Cancelled";
    });

    await order.save();

    res.status(200).json({ message: "Order cancelled successfully" });
  } catch (err) {
    res.status(500).json({ message: "Cancel error", error: err.message });
  }
});

// --------------------- USER PROFILE ---------------------
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      username: user.username,
      email: user.email,
      phone: user.phone,
    });
  } catch (err) {
    res.status(500).json({ message: "Profile error", error: err.message });
  }
});

module.exports = router;
