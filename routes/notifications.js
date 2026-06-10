const express = require('express');
const router  = express.Router();
const { auth } = require('../middleware/auth');
const Notification = require('../models/Notification');

// ── Get my notifications ──────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const notifs = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 }).limit(50);
    const unread = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    res.json({ notifications: notifs, unread });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Mark as read ──────────────────────────────────────────────────────────────
router.patch('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { $set: { isRead: true } });
    res.json({ message: 'All marked as read' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.patch('/:id/read', auth, async (req, res) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { $set: { isRead: true } });
    res.json({ message: 'Marked as read' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Create notification (internal use) ───────────────────────────────────────
router.post('/create', auth, async (req, res) => {
  try {
    const { userIds, title, message, type, link } = req.body;
    const notifs = await Notification.insertMany(
      userIds.map(userId => ({ userId, title, message, type: type||'system', link: link||'' }))
    );
    res.json({ created: notifs.length });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
