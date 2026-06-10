const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const { auth, requireRole } = require('../middleware/auth');
const Plan         = require('../models/Plan');
const Subscription = require('../models/Subscription');
const User         = require('../models/User');

let Razorpay;
try { Razorpay = require('razorpay'); } catch(e) { console.log('Razorpay not installed'); }

const getRazorpay = () => {
  if (!Razorpay) return null;
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// ── Create Razorpay order ─────────────────────────────────────────────────────
router.post('/create-order', auth, async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const razorpay = getRazorpay();
    if (!razorpay) return res.status(500).json({ message: 'Payment gateway not configured' });

    const order = await razorpay.orders.create({
      amount:   plan.price * 100, // paise
      currency: 'INR',
      receipt:  `order_${Date.now()}`,
      notes:    { planId: plan._id.toString(), userId: req.user._id.toString() },
    });

    const subscription = await Subscription.create({
      userId:          req.user._id,
      planId:          plan._id,
      planName:        plan.name,
      amount:          plan.price,
      status:          'pending',
      razorpayOrderId: order.id,
    });

    res.json({
      orderId:    order.id,
      amount:     order.amount,
      currency:   order.currency,
      keyId:      process.env.RAZORPAY_KEY_ID,
      planName:   plan.name,
      subId:      subscription._id,
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Verify payment ────────────────────────────────────────────────────────────
router.post('/verify', auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, subId } = req.body;

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign).digest('hex');

    if (expectedSign !== razorpay_signature)
      return res.status(400).json({ message: 'Invalid payment signature' });

    // Activate subscription
    const sub = await Subscription.findById(subId).populate('planId');
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });

    const startDate = new Date();
    const endDate   = new Date(startDate.getTime() + sub.planId.duration * 24 * 60 * 60 * 1000);

    sub.status            = 'active';
    sub.razorpayPaymentId = razorpay_payment_id;
    sub.startDate         = startDate;
    sub.endDate           = endDate;
    await sub.save();

    // Update user subscription status
    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        subscriptionStatus: 'active',
        subscriptionExpiry: endDate,
        currentPlan:        sub.planId.name,
      }
    });

    // Send confirmation email
    try {
      const { sendEmail } = require('../helpers/email');
      const user = await User.findById(req.user._id);
      await sendEmail({
        to:      user.email,
        subject: `✅ Subscription Activated — ${sub.planName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#1a2035;">Subscription Activated!</h2>
            <p>Dear ${user.name},</p>
            <p>Your <strong>${sub.planName}</strong> subscription has been activated.</p>
            <div style="background:#f0f6ff;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="margin:4px 0;"><strong>Plan:</strong> ${sub.planName}</p>
              <p style="margin:4px 0;"><strong>Amount:</strong> ₹${sub.amount}</p>
              <p style="margin:4px 0;"><strong>Valid till:</strong> ${endDate.toLocaleDateString('en-IN')}</p>
              <p style="margin:4px 0;"><strong>Payment ID:</strong> ${razorpay_payment_id}</p>
            </div>
            <p>Thank you for subscribing to CodeLab!</p>
          </div>
        `,
      });
    } catch(emailErr) { console.log('Email send failed:', emailErr.message); }

    res.json({ message: 'Payment verified', subscription: sub });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Get my subscription ───────────────────────────────────────────────────────
router.get('/my', auth, async (req, res) => {
  try {
    const sub = await Subscription.findOne({ userId: req.user._id, status: 'active' })
      .populate('planId').sort({ createdAt: -1 });
    res.json(sub || null);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Admin: All subscriptions ──────────────────────────────────────────────────
router.get('/all', auth, requireRole('admin'), async (req, res) => {
  try {
    const subs = await Subscription.find().populate('userId', 'name email').populate('planId', 'name').sort({ createdAt: -1 });
    res.json(subs);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
