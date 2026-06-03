const mongoose = require('mongoose');

const tutorSnippetSchema = new mongoose.Schema({
  tutorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  language: { type: String, required: true },
  label:    { type: String, required: true },
  code:     { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('TutorSnippet', tutorSnippetSchema);
