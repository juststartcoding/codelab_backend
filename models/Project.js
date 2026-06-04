const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  language: {
    type: String,
    enum: ["c", "cpp", "python", "java", "javascript"],
    default: "c",
  },
  content: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const commentSchema = new mongoose.Schema({
  tutorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  tutorName: String,
  fileId: String,
  lineNumber: Number,
  comment: String,
  createdAt: { type: Date, default: Date.now },
});

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    files: [fileSchema],
    comments: [commentSchema],
    language: {
      type: String,
      enum: ["c", "cpp", "python", "java", "javascript"],
      default: "c",
    },
    isSubmitted: { type: Boolean, default: false },
    grade: { type: String, default: "" },
    tutorFeedback: { type: String, default: "" },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tags: [String],
  },
  { timestamps: true },
);

projectSchema.index({ studentId: 1 });
projectSchema.index({ isSubmitted: 1 });

module.exports = mongoose.model("Project", projectSchema);
