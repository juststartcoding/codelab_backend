const express = require('express');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { auth, requireRole } = require('../middleware/auth');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');

const router = express.Router();

// ── Tutor: Create assignment ─────────────────────────────────────────────────
router.post('/', auth, requireRole('tutor'), async (req, res) => {
  try {
    const { title, description, language, testCases, batchId, deadline, starterCode } = req.body;
    if (!title) return res.status(400).json({ message: 'Title required' });
    const assignment = await Assignment.create({
      title, description: description||'', language: language||'c',
      testCases: testCases||[], batchId: batchId||null,
      deadline: deadline ? new Date(deadline) : null,
      starterCode: starterCode||'', tutorId: req.user._id,
    });
    res.status(201).json(assignment);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Tutor: Get my assignments ────────────────────────────────────────────────
router.get('/my', auth, requireRole('tutor'), async (req, res) => {
  try {
    const assignments = await Assignment.find({ tutorId: req.user._id }).sort({ createdAt:-1 }).lean();
    res.json(assignments);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Student: Get available assignments ──────────────────────────────────────
router.get('/available', auth, requireRole('student'), async (req, res) => {
  try {
    const assignments = await Assignment.find({ isActive: true }).sort({ createdAt:-1 }).lean();
    // attach student's last submission to each
    const ids = assignments.map(a => a._id);
    const subs = await Submission.find({ studentId: req.user._id, assignmentId: { $in: ids } })
      .sort({ submittedAt:-1 }).lean();
    const subMap = {};
    subs.forEach(s => { if (!subMap[s.assignmentId]) subMap[s.assignmentId] = s; });
    res.json(assignments.map(a => ({ ...a, mySubmission: subMap[a._id] || null })));
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Get single assignment ────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const a = await Assignment.findById(req.params.id).lean();
    if (!a) return res.status(404).json({ message: 'Not found' });
    // Hide hidden test cases for students
    if (req.user.role === 'student') {
      a.testCases = a.testCases.map(t => t.isHidden ? { ...t, expectedOutput:'[hidden]', input:'[hidden]' } : t);
    }
    res.json(a);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Tutor: Update assignment ─────────────────────────────────────────────────
router.patch('/:id', auth, requireRole('tutor'), async (req, res) => {
  try {
    const a = await Assignment.findOneAndUpdate(
      { _id: req.params.id, tutorId: req.user._id },
      { $set: req.body }, { new: true }
    );
    if (!a) return res.status(404).json({ message: 'Not found' });
    res.json(a);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Tutor: Delete assignment ─────────────────────────────────────────────────
router.delete('/:id', auth, requireRole('tutor'), async (req, res) => {
  try {
    await Assignment.deleteOne({ _id: req.params.id, tutorId: req.user._id });
    res.json({ message: 'Deleted' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Run code against test cases ──────────────────────────────────────────────
function runWithStdin(code, language, stdin, timeout = 8000) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-'));
  try {
    let filename, compileCmd, runCmd;
    switch (language) {
      case 'c':
        filename = path.join(tmpDir, 'main.c');
        fs.writeFileSync(filename, code);
        compileCmd = `gcc "${filename}" -o "${path.join(tmpDir,'main')}" -lm 2>&1`;
        runCmd = `"${path.join(tmpDir,'main')}"`;
        break;
      case 'cpp':
        filename = path.join(tmpDir, 'main.cpp');
        fs.writeFileSync(filename, code);
        compileCmd = `g++ "${filename}" -o "${path.join(tmpDir,'main')}" -std=c++17 2>&1`;
        runCmd = `"${path.join(tmpDir,'main')}"`;
        break;
      case 'python':
        filename = path.join(tmpDir, 'main.py');
        fs.writeFileSync(filename, code);
        runCmd = `python3 "${filename}"`;
        break;
      case 'java':
        filename = path.join(tmpDir, 'Main.java');
        fs.writeFileSync(filename, code);
        compileCmd = `javac "${filename}" -d "${tmpDir}" 2>&1`;
        runCmd = `java -cp "${tmpDir}" Main`;
        break;
      case 'javascript':
        filename = path.join(tmpDir, 'main.js');
        fs.writeFileSync(filename, code);
        runCmd = `node "${filename}"`;
        break;
      default: return { output: 'Unsupported language', error: true };
    }
    if (compileCmd) {
      try { execSync(compileCmd, { timeout, stdio:'pipe' }); }
      catch(e) { return { output: e.stdout?.toString()||e.message, error:true, compilationError:true }; }
    }
    const stdout = execSync(runCmd, { timeout, stdio:'pipe', maxBuffer:1024*512, input: stdin||'' }).toString();
    return { output: stdout.trim(), error: false };
  } catch(e) {
    return { output: (e.stdout?.toString()||e.stderr?.toString()||e.message).trim(), error: true };
  } finally {
    try { fs.rmSync(tmpDir, { recursive:true, force:true }); } catch {}
  }
}

// ── Student: Submit assignment (auto-grade) ──────────────────────────────────
router.post('/:id/submit', auth, requireRole('student'), async (req, res) => {
  try {
    const { code, language } = req.body;
    const assignment = await Assignment.findById(req.params.id).lean();
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    const testResults = [];
    let passed = 0;

    for (const tc of assignment.testCases) {
      const result = runWithStdin(code, language, tc.input);
      const actualOutput = result.output.trim();
      const expectedOutput = tc.expectedOutput.trim();
      const ok = actualOutput === expectedOutput;
      if (ok) passed++;
      testResults.push({
        label: tc.label || `Test ${testResults.length + 1}`,
        input: tc.isHidden ? '[hidden]' : tc.input,
        expectedOutput: tc.isHidden ? '[hidden]' : tc.expectedOutput,
        actualOutput: tc.isHidden ? (ok ? '[passed]' : '[failed]') : actualOutput,
        passed: ok,
        isHidden: tc.isHidden,
      });
    }

    const score = assignment.testCases.length > 0
      ? Math.round((passed / assignment.testCases.length) * 100)
      : 0;

    const submission = await Submission.create({
      assignmentId: assignment._id,
      studentId: req.user._id,
      code, language,
      testResults,
      score,
      totalCases: assignment.testCases.length,
      passed,
      status: 'graded',
    });

    res.status(201).json(submission);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Tutor: View submissions for an assignment ────────────────────────────────
router.get('/:id/submissions', auth, requireRole('tutor','admin'), async (req, res) => {
  try {
    const subs = await Submission.find({ assignmentId: req.params.id })
      .populate('studentId', 'name email')
      .sort({ submittedAt: -1 }).lean();
    res.json(subs);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
