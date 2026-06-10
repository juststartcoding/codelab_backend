const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email not configured — skipping:', subject);
    return;
  }
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"CodeLab" <${process.env.EMAIL_USER}>`,
    to, subject, html, text,
  });
};

const sendSessionAlert = async (studentEmails, sessionTitle, roomId, tutorName) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1a2035;">🔴 Live Session Started!</h2>
      <p><strong>${tutorName}</strong> has started a live session.</p>
      <div style="background:#f0fff4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:4px 0;font-size:18px;font-weight:bold;">${sessionTitle}</p>
        <p style="margin:4px 0;color:#166534;">Room Code: <strong style="font-size:20px;letter-spacing:2px;">${roomId}</strong></p>
      </div>
      <p>Join now at: <a href="${process.env.FRONTEND_URL}/student/sessions/${roomId}">Click here to join</a></p>
    </div>
  `;
  for (const email of studentEmails) {
    try { await sendEmail({ to: email, subject: `🔴 Live Session: ${sessionTitle}`, html }); }
    catch(e) { console.log('Failed to send to', email, e.message); }
  }
};

const sendAssignmentAlert = async (studentEmails, assignmentTitle, deadline, tutorName) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1a2035;">📝 New Assignment</h2>
      <p><strong>${tutorName}</strong> has assigned you a new task.</p>
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:4px 0;font-size:16px;font-weight:bold;">${assignmentTitle}</p>
        ${deadline ? `<p style="margin:4px 0;color:#92400e;">⏰ Deadline: <strong>${new Date(deadline).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})}</strong></p>` : ''}
      </div>
      <p>Login to CodeLab to complete this assignment.</p>
    </div>
  `;
  for (const email of studentEmails) {
    try { await sendEmail({ to: email, subject: `📝 New Assignment: ${assignmentTitle}`, html }); }
    catch(e) { console.log('Failed to send to', email, e.message); }
  }
};

module.exports = { sendEmail, sendSessionAlert, sendAssignmentAlert };
