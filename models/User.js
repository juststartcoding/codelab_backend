const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['admin', 'tutor', 'student'], default: 'student' },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
  isApproved: { type: Boolean, default: true }, // tutors need approval
  languages: [{ type: String, enum: ['c', 'cpp', 'python', 'java', 'javascript'] }],
  createdAt: { type: Date, default: Date.now },
  lastLogin:          { type: Date },
  subscriptionStatus: { type: String, enum: ['free','active','expired'], default: 'free' },
  subscriptionExpiry: { type: Date, default: null },
  currentPlan:        { type: String, default: 'Free' }
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isApproved: 1 });

module.exports = mongoose.model('User', userSchema);
