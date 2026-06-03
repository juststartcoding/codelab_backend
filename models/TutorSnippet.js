const mongoose = require("mongoose");

const tutorSnippetSchema = new mongoose.Schema(
  {
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    language: { type: String, required: true },
    code: { type: String, required: true },
    category: { type: String, default: "General" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("TutorSnippet", tutorSnippetSchema);
