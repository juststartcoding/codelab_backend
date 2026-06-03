const express = require('express');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { stripPassword } = require('../helpers');

const router = express.Router();
const mkId = () => Math.random().toString(36).substr(2,9) + Date.now().toString(36);

// ── Tutor: create batch ──────────────────────────────────────────────────────
router.post('/', auth, requireRole('tutor','admin'), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Batch name required' });
    const batch = await db.batches.insert({
      name: name.trim(), description: description || '',
      tutorId: req.user._id, tutorName: req.user.name,
      studentIds: [], createdAt: new Date(), updatedAt: new Date(),
    });
    res.status(201).json(batch);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── Tutor: get own batches ───────────────────────────────────────────────────
router.get('/', auth, requireRole('tutor','admin'), async (req, res) => {
  try {
    const batches = await db.batches.find({ tutorId: req.user._id }).lean();
    batches.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
    // Populate student details
    const populated = await Promise.all(batches.map(async b => {
      const students = b.studentIds.length
        ? await db.users.find({ _id: { $in: b.studentIds }, role:'student' }).lean()
        : [];
      return { ...b, students: students.map(stripPassword) };
    }));
    res.json(populated);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── Tutor: get single batch ──────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const batch = await db.batches.findOne({ _id: req.params.id });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const students = batch.studentIds.length
      ? await db.users.find({ _id: { $in: batch.studentIds }, role:'student' }).lean()
      : [];
    res.json({ ...batch, students: students.map(stripPassword) });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── Tutor: update batch name/description ─────────────────────────────────────
router.patch('/:id', auth, requireRole('tutor','admin'), async (req, res) => {
  try {
    const { name, description } = req.body;
    await db.batches.update(
      { _id: req.params.id, tutorId: req.user._id },
      { $set: { name, description, updatedAt: new Date() } }
    );
    const updated = await db.batches.findOne({ _id: req.params.id });
    res.json(updated);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── Tutor: delete batch ──────────────────────────────────────────────────────
router.delete('/:id', auth, requireRole('tutor','admin'), async (req, res) => {
  try {
    await db.batches.remove({ _id: req.params.id, tutorId: req.user._id }, {});
    res.json({ message: 'Batch deleted' });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── Add student to batch (by email) ─────────────────────────────────────────
router.post('/:id/students', auth, requireRole('tutor','admin'), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Student email required' });
    const student = await db.users.findOne({ email: email.toLowerCase(), role:'student' });
    if (!student) return res.status(404).json({ message: `No student found with email: ${email}` });
    const batch = await db.batches.findOne({ _id: req.params.id });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    if (batch.studentIds.includes(student._id))
      return res.status(400).json({ message: `${student.name} is already in this batch` });
    const studentIds = [...batch.studentIds, student._id];
    await db.batches.update({ _id: req.params.id }, { $set: { studentIds, updatedAt: new Date() } });
    res.json({ message: `${student.name} added to batch`, student: stripPassword(student) });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── Remove student from batch ─────────────────────────────────────────────────
router.delete('/:id/students/:studentId', auth, requireRole('tutor','admin'), async (req, res) => {
  try {
    const batch = await db.batches.findOne({ _id: req.params.id });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const studentIds = batch.studentIds.filter(sid => sid !== req.params.studentId);
    await db.batches.update({ _id: req.params.id }, { $set: { studentIds, updatedAt: new Date() } });
    res.json({ message: 'Student removed from batch' });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── Student: get own batches ──────────────────────────────────────────────────
router.get('/student/mine', auth, requireRole('student'), async (req, res) => {
  try {
    const batches = await db.batches.find({ studentIds: req.user._id }).lean();
    batches.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
    res.json(batches);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── All students list (for batch assignment) ──────────────────────────────────
router.get('/utils/all-students', auth, requireRole('tutor','admin'), async (req, res) => {
  try {
    const students = await db.users.find({ role:'student' }).lean();
    res.json(students.map(stripPassword));
  } catch(err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
