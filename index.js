const path = require("path");
const express = require("express");
const cors = require("cors");
const session = require("express-session");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Mongo = require("./mongodb");
const User = require("./models/User");
const Cart = require("./models/Cart");
const Order = require("./models/Order");
const Product = require("./models/Product");

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "secret_key_123",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  })
);

// Test Route
app.get("/", (req, res) => {
  res.send("API is running successfully ");
});

// Connect Mongo
Mongo();

app.use("/api/user", require("./routes/user"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/order", require("./routes/order"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/products", require("./routes/products"));


// Start Server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
