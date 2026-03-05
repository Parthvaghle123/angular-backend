const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const SECRET_KEY = "MY_SUPER_SECRET_KEY";

// --------------------- Verify Email ---------------------
router.post("/verify-email", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  res.json({ exists: !!user });
});

// --------------------- Change Password ---------------------
router.post("/change-password", async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ message: "User not found" });

    if (newPassword.length < 8) {
      return res.json({ message: "Password must be at least 8 characters" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully ✅" });
  } catch (err) {
    res.status(500).json({ message: "Error updating password" });
  }
});

// --------------------- Login ---------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (password.length < 8) {
    return res.json({ message: "Password must be at least 8 characters" });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.json({ message: "No user found" });
  if (user.password !== password) return res.json({ message: "Password incorrect" });

  const token = jwt.sign(
    { id: user._id, email: user.email },
    SECRET_KEY,
    { expiresIn: "1d" }
  );

  res.json({
    message: "Success",
    token,
    username: user.username,
  });
});

// --------------------- Register ---------------------
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const newUser = await User.create({
      ...req.body,
      email: email.toLowerCase(),
    });

    res.status(200).json({ success: true, user: newUser });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err });
  }
});

module.exports = router;
