const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  tutorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentIds:[{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive:  { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Batch', batchSchema);
