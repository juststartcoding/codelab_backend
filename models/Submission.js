const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
  label:          String,
  input:          String,
  expectedOutput: String,
  actualOutput:   String,
  passed:         Boolean,
  isHidden:       Boolean,
});

const submissionSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code:         { type: String, required: true },
  language:     { type: String, required: true },
  testResults:  [testResultSchema],
  score:        { type: Number, default: 0 },
  totalCases:   { type: Number, default: 0 },
  passed:       { type: Number, default: 0 },
  status:       { type: String, enum: ['pending','graded'], default: 'pending' },
  submittedAt:  { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Submission', submissionSchema);
