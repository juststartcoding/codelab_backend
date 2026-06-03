const express = require('express');
const db = require('../db');
const { hashPassword, stripPassword } = require('../helpers');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Register tutor
router.post('/register-tutor', auth, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, bio, languages } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password required' });
    const exists = await db.users.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Email already registered' });
    const hashed = await hashPassword(password);
    const tutor = await db.users.insert({
      name, email: email.toLowerCase(), password: hashed,
      role: 'tutor', isApproved: true, bio: bio || '',
      languages: languages || ['c', 'cpp'],
      createdAt: new Date(), lastLogin: null
    });
    res.status(201).json({ message: 'Tutor registered successfully', tutor: stripPassword(tutor) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/tutors', auth, requireRole('admin'), async (req, res) => {
  try {
    const tutors = await db.users.find({ role: 'tutor' });
    res.json(tutors.map(stripPassword).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/students', auth, requireRole('admin'), async (req, res) => {
  try {
    const students = await db.users.find({ role: 'student' });
    res.json(students.map(stripPassword).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch('/tutors/:id/approval', auth, requireRole('admin'), async (req, res) => {
  try {
    const tutor = await db.users.findOne({ _id: req.params.id, role: 'tutor' });
    if (!tutor) return res.status(404).json({ message: 'Tutor not found' });
    await db.users.update({ _id: req.params.id }, { $set: { isApproved: !tutor.isApproved } });
    const updated = await db.users.findOne({ _id: req.params.id });
    res.json({ message: `Tutor ${updated.isApproved ? 'approved' : 'suspended'}`, tutor: stripPassword(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/users/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.users.remove({ _id: req.params.id }, {});
    res.json({ message: 'User deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/stats', auth, requireRole('admin'), async (req, res) => {
  try {
    const [students, tutors, totalUsers] = await Promise.all([
      db.users.count({ role: 'student' }),
      db.users.count({ role: 'tutor' }),
      db.users.count({}),
    ]);
    res.json({ students, tutors, totalUsers });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
