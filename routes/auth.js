const express = require("express");
const db = require("../db");
const { signToken, comparePassword, stripPassword } = require("../helpers");
const { auth } = require("../middleware/auth");

const router = express.Router();

// Student register
router.post("/student/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });
    if (password.length < 6)
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    const exists = await db.users.findOne({ email: email.toLowerCase() });
    if (exists)
      return res.status(400).json({ message: "Email already registered" });
    const user = await db.users.insert({
      name,
      email: email.toLowerCase(),
      password: password,
      role: "student",
      isApproved: true,
      createdAt: new Date(),
      lastLogin: null,
    });
    const token = signToken(user._id);
    res.status(201).json({ token, user: stripPassword(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Generic login helper
async function doLogin(req, res, role) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });
    const user = await db.users.findOne({ email: email.toLowerCase(), role });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if (role === "tutor" && !user.isApproved)
      return res
        .status(403)
        .json({ message: "Account pending admin approval" });
    const ok = await comparePassword(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    await db.users.update(
      { _id: user._id },
      { $set: { lastLogin: new Date() } },
    );
    const token = signToken(user._id);
    res.json({ token, user: stripPassword(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

router.post("/student/login", (req, res) => doLogin(req, res, "student"));
router.post("/tutor/login", (req, res) => doLogin(req, res, "tutor"));
router.post("/admin/login", (req, res) => doLogin(req, res, "admin"));

router.get("/me", auth, (req, res) =>
  res.json({ user: stripPassword(req.user) }),
);

module.exports = router;
