const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    roomId: { type: String, required: true, unique: true },
    language: {
      type: String,
      enum: ["c", "cpp", "python", "java", "javascript"],
      default: "c",
    },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: false },
    startedAt: { type: Date },
    endedAt: { type: Date },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    codeSnapshot: { type: String, default: "" },
  },
  { timestamps: true },
);

sessionSchema.index({ isActive: 1 });
sessionSchema.index({ tutorId: 1 });
sessionSchema.index({ roomId: 1 }, { unique: true });

module.exports = mongoose.model("Session", sessionSchema);
