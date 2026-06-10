const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName:  { type: String, required: true },
  courseName:   { type: String, required: true },
  tutorName:    { type: String, required: true },
  issueDate:    { type: Date, default: Date.now },
  certificateId:{ type: String, unique: true },          // e.g. CL-2025-0001
  grade:        { type: String, default: '' },
  totalSessions:{ type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Certificate', certificateSchema);
