const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  planId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  planName:       { type: String },
  amount:         { type: Number, required: true },
  status:         { type: String, enum: ['pending','active','expired','cancelled'], default: 'pending' },
  razorpayOrderId:{ type: String, default: '' },
  razorpayPaymentId:{ type: String, default: '' },
  startDate:      { type: Date },
  endDate:        { type: Date },
  autoRenew:      { type: Boolean, default: false },
}, { timestamps: true });

subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
