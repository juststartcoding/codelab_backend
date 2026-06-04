const express = require("express");
const db = require("../db");
const { makeRoomId } = require("../helpers");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Tutor: create session
router.post("/", auth, requireRole("tutor"), async (req, res) => {
  try {
    const { title, language, description } = req.body;
    if (!title) return res.status(400).json({ message: "Title required" });
    const roomId = makeRoomId();
    const session = await db.sessions.insert({
      title,
      language: language || "c",
      description: description || "",
      tutorId: req.user._id,
      tutorName: req.user.name,
      batchId: req.body.batchId || null,
      roomId,
      isActive: true,
      startedAt: new Date(),
      endedAt: null,
      participants: [],
      codeSnapshot: "",
      createdAt: new Date(),
    });
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all active sessions (student only sees sessions for their batches or public ones)
router.get("/active", auth, async (req, res) => {
  try {
    let allActive = await db.sessions.find({ isActive: true }).lean();
    allActive.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    if (req.user.role === "student") {
      // Get student batches — compare as strings for ObjectId safety
      const myBatches = await db.batches._model
        .find({ studentIds: req.user._id })
        .lean();
      const myBatchIds = myBatches.map((b) => b._id.toString());
      // Show session if: no batchId (public) OR student is in that batch
      allActive = allActive.filter(
        (s) => !s.batchId || myBatchIds.includes(s.batchId?.toString()),
      );
    }

    const result = allActive.map((s) => ({
      ...s,
      tutorId: { _id: s.tutorId, name: s.tutorName },
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Tutor's sessions
router.get("/my", auth, requireRole("tutor"), async (req, res) => {
  try {
    const sessions = await db.sessions.find({ tutorId: req.user._id }).lean();
    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get by room ID
router.get("/room/:roomId", auth, async (req, res) => {
  try {
    const session = await db.sessions.findOne({ roomId: req.params.roomId });
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json({
      ...session,
      tutorId: { _id: session.tutorId, name: session.tutorName },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get by session ID
router.get("/:id", auth, async (req, res) => {
  try {
    const session = await db.sessions.findOne({ _id: req.params.id });
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json({
      ...session,
      tutorId: { _id: session.tutorId, name: session.tutorName },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// End session
router.patch("/:id/end", auth, requireRole("tutor"), async (req, res) => {
  try {
    await db.sessions.update(
      { _id: req.params.id, tutorId: req.user._id },
      {
        $set: {
          isActive: false,
          endedAt: new Date(),
          codeSnapshot: req.body.codeSnapshot || "",
        },
      },
    );
    const session = await db.sessions.findOne({ _id: req.params.id });
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Shared Notepad ────────────────────────────────────────────────────────────
router.patch("/:id/notepad", auth, requireRole("tutor"), async (req, res) => {
  try {
    const { content } = req.body;
    const session = await db.sessions._model
      .findByIdAndUpdate(
        req.params.id,
        { $set: { notepad: content } },
        { new: true },
      )
      .lean();
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json({ notepad: session.notepad });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/:id/notepad", auth, async (req, res) => {
  try {
    const session = await db.sessions._model.findById(req.params.id).lean();
    if (!session) return res.status(404).json({ message: "Not found" });
    res.json({ notepad: session.notepad || "" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
