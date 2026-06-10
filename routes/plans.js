const express  = require('express');
const router   = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const Plan     = require('../models/Plan');
const Subscription = require('../models/Subscription');

// ── Public: Get all active plans ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ price: 1 });
    res.json(plans);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Admin: Get all plans (including inactive) ─────────────────────────────────
router.get('/all', auth, requireRole('admin'), async (req, res) => {
  try {
    const plans = await Plan.find().sort({ price: 1 });
    res.json(plans);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Admin: Create plan ────────────────────────────────────────────────────────
router.post('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const { name, description, price, duration, durationType, features, maxStudents, maxSessions, isPopular, color } = req.body;
    if (!name || !price || !duration) return res.status(400).json({ message: 'Name, price and duration required' });
    const plan = await Plan.create({ name, description, price, duration, durationType: durationType||'monthly', features: features||[], maxStudents: maxStudents||100, maxSessions: maxSessions||-1, isPopular: isPopular||false, color: color||'#3b82f6' });
    res.status(201).json(plan);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Admin: Update plan ────────────────────────────────────────────────────────
router.patch('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json(plan);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Admin: Delete plan ────────────────────────────────────────────────────────
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await Plan.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
