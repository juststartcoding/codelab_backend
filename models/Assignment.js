const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  input:          { type: String, default: '' },
  expectedOutput: { type: String, required: true },
  label:          { type: String, default: '' },
  isHidden:       { type: Boolean, default: false },
});

const assignmentSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  tutorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  language:    { type: String, enum: ['c','cpp','python','java','javascript'], default: 'c' },
  testCases:   [testCaseSchema],
  batchId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', default: null },
  deadline:    { type: Date, default: null },
  starterCode: { type: String, default: '' },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Assignment', assignmentSchema);
