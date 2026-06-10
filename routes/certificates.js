const express = require('express');
const router  = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const Certificate = require('../models/Certificate');
const User        = require('../models/User');

// Generate unique certificate ID
const genCertId = () => {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `CL-${year}-${rand}`;
};

// ── Tutor: Issue certificate ──────────────────────────────────────────────────
router.post('/issue', auth, requireRole('tutor', 'admin'), async (req, res) => {
  try {
    const { studentId, courseName, grade, totalSessions } = req.body;
    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const cert = await Certificate.create({
      studentId,
      studentName:   student.name,
      courseName,
      tutorName:     req.user.name,
      grade:         grade || '',
      totalSessions: totalSessions || 0,
      certificateId: genCertId(),
    });

    // Send email
    try {
      const { sendEmail } = require('../helpers/email');
      await sendEmail({
        to: student.email,
        subject: `🎓 Certificate Issued — ${courseName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#1a2035;">🎓 Congratulations!</h2>
            <p>Dear ${student.name},</p>
            <p>You have been awarded a certificate for <strong>${courseName}</strong>.</p>
            <div style="background:#f0fff4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="margin:4px 0;"><strong>Certificate ID:</strong> ${cert.certificateId}</p>
              <p style="margin:4px 0;"><strong>Course:</strong> ${courseName}</p>
              ${grade ? `<p style="margin:4px 0;"><strong>Grade:</strong> ${grade}</p>` : ''}
              <p style="margin:4px 0;"><strong>Issued by:</strong> ${req.user.name}</p>
            </div>
            <p>Login to CodeLab to download your certificate.</p>
          </div>
        `,
      });
    } catch(e) { console.log('Email failed:', e.message); }

    res.status(201).json(cert);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Student: My certificates ──────────────────────────────────────────────────
router.get('/my', auth, async (req, res) => {
  try {
    const certs = await Certificate.find({ studentId: req.user._id }).sort({ createdAt: -1 });
    res.json(certs);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Public: Verify certificate ────────────────────────────────────────────────
router.get('/verify/:certId', async (req, res) => {
  try {
    const cert = await Certificate.findOne({ certificateId: req.params.certId });
    if (!cert) return res.status(404).json({ valid: false, message: 'Certificate not found' });
    res.json({ valid: true, certificate: cert });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Tutor: All issued certificates ───────────────────────────────────────────
router.get('/issued', auth, requireRole('tutor', 'admin'), async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { tutorName: req.user.name };
    const certs = await Certificate.find(query).sort({ createdAt: -1 });
    res.json(certs);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Generate PDF certificate ──────────────────────────────────────────────────
router.get('/:certId/pdf', auth, async (req, res) => {
  try {
    const cert = await Certificate.findOne({ certificateId: req.params.certId });
    if (!cert) return res.status(404).json({ message: 'Not found' });

    let PDFDocument;
    try { PDFDocument = require('pdfkit'); } catch(e) {
      return res.status(500).json({ message: 'PDF generation not available' });
    }

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${cert.certificateId}.pdf"`);
    doc.pipe(res);

    // Background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f8faff');
    doc.rect(20, 20, doc.page.width-40, doc.page.height-40).stroke('#1a2035');
    doc.rect(25, 25, doc.page.width-50, doc.page.height-50).stroke('#3b82f6');

    // Header
    doc.fillColor('#1a2035').fontSize(40).font('Helvetica-Bold')
      .text('CodeLab', { align: 'center' });
    doc.fontSize(14).font('Helvetica').fillColor('#64748b')
      .text('Certificate of Completion', { align: 'center' });
    doc.moveDown(0.5);

    // Divider
    doc.moveTo(100, doc.y).lineTo(doc.page.width-100, doc.y).stroke('#3b82f6');
    doc.moveDown(1);

    // Body
    doc.fontSize(16).fillColor('#475569').font('Helvetica')
      .text('This is to certify that', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(32).fillColor('#1a2035').font('Helvetica-Bold')
      .text(cert.studentName, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(16).fillColor('#475569').font('Helvetica')
      .text('has successfully completed', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(26).fillColor('#3b82f6').font('Helvetica-Bold')
      .text(cert.courseName, { align: 'center' });
    doc.moveDown(0.5);

    if (cert.grade) {
      doc.fontSize(16).fillColor('#475569').font('Helvetica')
        .text(`with Grade: ${cert.grade}`, { align: 'center' });
      doc.moveDown(0.5);
    }

    doc.moveTo(100, doc.y).lineTo(doc.page.width-100, doc.y).stroke('#e2e8f0');
    doc.moveDown(1);

    // Footer
    doc.fontSize(12).fillColor('#64748b')
      .text(`Issued by: ${cert.tutorName}  |  Date: ${new Date(cert.issueDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}  |  ID: ${cert.certificateId}`, { align: 'center' });

    doc.end();
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
