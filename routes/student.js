const express = require('express');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { stripPassword } = require('../helpers');
const router = express.Router();

router.get('/profile', auth, requireRole('student'), (req, res) => res.json(stripPassword(req.user)));

router.patch('/profile', auth, requireRole('student'), async (req, res) => {
  try {
    const { name, bio } = req.body;
    await db.users.update({ _id: req.user._id }, { $set: { name, bio } });
    const updated = await db.users.findOne({ _id: req.user._id });
    res.json(stripPassword(updated));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
