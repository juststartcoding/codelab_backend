const express = require('express');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { stripPassword, getDefaultContent } = require('../helpers');

const router = express.Router();
const mkId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

// ── Profile ──────────────────────────────────────────────────────────────────
router.get('/profile', auth, requireRole('tutor'), (req, res) => {
  res.json(stripPassword(req.user));
});

router.patch('/profile', auth, requireRole('tutor'), async (req, res) => {
  try {
    const { name, bio, languages } = req.body;
    await db.users.update({ _id: req.user._id }, { $set: { name, bio, languages } });
    const updated = await db.users.findOne({ _id: req.user._id });
    res.json(stripPassword(updated));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Snippets (saved programs, categorized) ───────────────────────────────────
router.get('/snippets', auth, requireRole('tutor'), async (req, res) => {
  try {
    const snippets = await db.tutorSnippets.find({ tutorId: req.user._id }).lean();
    snippets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(snippets);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/snippets', auth, requireRole('tutor'), async (req, res) => {
  try {
    const { name, language, code, category } = req.body;
    if (!name) return res.status(400).json({ message: 'Name required' });
    const snippet = await db.tutorSnippets.insert({
      tutorId: req.user._id,
      name,
      language: language || 'c',
      code: code || getDefaultContent(language || 'c'),
      category: category || 'General',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    res.status(201).json(snippet);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch('/snippets/:id', auth, requireRole('tutor'), async (req, res) => {
  try {
    const { name, code, category, language } = req.body;
    const updates = { updatedAt: new Date() };
    if (name     !== undefined) updates.name     = name;
    if (code     !== undefined) updates.code     = code;
    if (category !== undefined) updates.category = category;
    if (language !== undefined) updates.language = language;
    await db.tutorSnippets.update(
      { _id: req.params.id, tutorId: req.user._id },
      { $set: updates }
    );
    const updated = await db.tutorSnippets.findOne({ _id: req.params.id });
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/snippets/:id', auth, requireRole('tutor'), async (req, res) => {
  try {
    await db.tutorSnippets.remove({ _id: req.params.id, tutorId: req.user._id }, {});
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
