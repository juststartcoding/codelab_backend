const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name:        { type: String, required: true },          // "Basic", "Pro", "Enterprise"
  description: { type: String, default: '' },
  price:       { type: Number, required: true },          // INR amount
  duration:    { type: Number, required: true },          // days
  durationType:{ type: String, enum: ['monthly','yearly','custom'], default: 'monthly' },
  features:    [{ type: String }],                        // feature list
  maxStudents: { type: Number, default: 100 },
  maxSessions: { type: Number, default: -1 },             // -1 = unlimited
  isActive:    { type: Boolean, default: true },
  isPopular:   { type: Boolean, default: false },
  color:       { type: String, default: '#3b82f6' },
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
