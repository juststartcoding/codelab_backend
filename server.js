const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// MongoDB — seed sirf ek baar run karo: node seed.js
// Serve frontend build files
if (process.env.SERVE_FRONTEND === 'true') {
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  });
}

const app = express();
const server = http.createServer(app);
const db = require('./db');

const FRONTEND_URL = process.env.FRONTEND_URL || '*';  // '*' allows LAN devices in dev

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? FRONTEND_URL : '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const corsOrigin = process.env.NODE_ENV === 'production' ? FRONTEND_URL : '*';
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/tutor',    require('./routes/tutor'));
app.use('/api/student',  require('./routes/student'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/batches',      require('./routes/batches'));
app.use('/api/assignments',   require('./routes/assignments'));
app.use('/api/ai',            require('./routes/ai'));
app.use('/api/plans',         require('./routes/plans'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/certificates',  require('./routes/certificates'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CodeLab API running (NeDB — no MongoDB needed)' });
});

// ─── In-memory room state ─────────────────────────────────────────────────────
// roomId → { tutorCode, language, tutorId, tutorSocketId, students: Set }
const activeRooms = new Map();

// Helper: load session from DB and seed room entry if missing
async function ensureRoom(roomId) {
  if (activeRooms.has(roomId)) return activeRooms.get(roomId);
  // Look up the session in DB to verify it's legitimately active
  const session = await db.sessions.findOne({ roomId, isActive: true });
  if (!session) return null;
  // Create a room entry (tutor not yet connected via socket)
  const room = {
    tutorCode: session.codeSnapshot || '',
    language: session.language || 'c',
    tutorId: session.tutorId,
    tutorSocketId: null,   // tutor hasn't joined via socket yet
    students: new Set(),
  };
  activeRooms.set(roomId, room);
  return room;
}

io.on('connection', (socket) => {

  // ── TUTOR joins / re-joins room ──────────────────────────────────────────
  socket.on('tutor:create-room', async ({ roomId, tutorId, language }) => {
    let room = activeRooms.get(roomId);
    if (!room) {
      room = { tutorCode: '', language: language || 'c', tutorId, tutorSocketId: socket.id, students: new Set() };
      activeRooms.set(roomId, room);
    } else {
      // Tutor reconnected — update socket id & language
      room.tutorSocketId = socket.id;
      room.tutorId = tutorId;
      if (language) room.language = language;
    }
    socket.join(roomId);
    Object.assign(socket.data, { roomId, role: 'tutor', tutorId });

    socket.emit('room:joined', { roomId, code: room.tutorCode, language: room.language });

    // Tell any already-waiting students that tutor is now live
    socket.to(roomId).emit('tutor:connected', { language: room.language });

    console.log(`[room:${roomId}] Tutor ${tutorId} connected`);
  });

  // ── STUDENT joins room ───────────────────────────────────────────────────
  socket.on('student:join-room', async ({ roomId, studentId, studentName }) => {
    // Try to load room from memory or DB
    const room = await ensureRoom(roomId);

    if (!room) {
      socket.emit('room:error', { message: 'Session not found. Check the room code or ask your tutor.' });
      return;
    }

    socket.join(roomId);
    room.students.add(studentId);
    Object.assign(socket.data, { roomId, role: 'student', studentId });

    // If tutor isn't connected via socket yet, put student in "waiting" state
    const tutorLive = room.tutorSocketId !== null;

    socket.emit('room:joined', {
      roomId,
      code: room.tutorCode,
      language: room.language,
      tutorLive,   // student UI uses this to show "Waiting for tutor..." banner
    });

    // Notify everyone in room about student joining
    io.to(roomId).emit('student:joined', {
      studentId,
      studentName,
      count: room.students.size,
    });

    console.log(`[room:${roomId}] Student "${studentName}" joined (tutorLive=${tutorLive})`);
  });

  // ── TUTOR broadcasts code change ─────────────────────────────────────────
  // ── Interactive Terminal via Socket ────────────────────────────────────────
  const { spawn, execSync: execSyncTerm } = require('child_process');
  const fsTerm   = require('fs');
  const osTerm   = require('os');
  const pathTerm = require('path');

  // Tutor starts interactive run
  socket.on('terminal:run', ({ roomId, code, language, stdin }) => {
    const room = activeRooms.get(roomId);
    if (!room) return;

    // Broadcast "starting" to students
    io.to(roomId).emit('terminal:output', { text: '\x1b[90m\u25b6 Running...\x1b[0m\n', type: 'system' });

    const tmpDir = fsTerm.mkdtempSync(pathTerm.join(osTerm.tmpdir(), 'cl-term-'));
    let filename, compileCmd, runArgs;

    try {
      switch(language) {
        case 'c':
          filename   = pathTerm.join(tmpDir,'main.c');
          fsTerm.writeFileSync(filename, code);
          compileCmd = ['gcc',[filename,'-o',pathTerm.join(tmpDir,'main'),'-lm']];
          runArgs    = [pathTerm.join(tmpDir,'main'),[]];
          break;
        case 'cpp':
          filename   = pathTerm.join(tmpDir,'main.cpp');
          fsTerm.writeFileSync(filename, code);
          compileCmd = ['g++',[filename,'-o',pathTerm.join(tmpDir,'main'),'-std=c++17']];
          runArgs    = [pathTerm.join(tmpDir,'main'),[]];
          break;
        case 'python':
          filename = pathTerm.join(tmpDir,'main.py');
          fsTerm.writeFileSync(filename, code);
          runArgs  = ['python3',['-u',filename]];
          break;
        case 'java':
          filename   = pathTerm.join(tmpDir,'Main.java');
          fsTerm.writeFileSync(filename, code);
          compileCmd = ['javac',[filename,'-d',tmpDir]];
          runArgs    = ['java',['-cp',tmpDir,'Main']];
          break;
        case 'javascript':
          filename = pathTerm.join(tmpDir,'main.js');
          fsTerm.writeFileSync(filename, code);
          runArgs  = ['node',[filename]];
          break;
        default:
          io.to(roomId).emit('terminal:output', { text: 'Unsupported language\n', type: 'error' });
          return;
      }

      // Compile
      if (compileCmd) {
        try {
          execSyncTerm(`${compileCmd[0]} ${compileCmd[1].join(' ')}`, { timeout:8000, stdio:'pipe' });
        } catch(e) {
          const errMsg = e.stdout?.toString() || e.message;
          io.to(roomId).emit('terminal:output', { text: errMsg, type: 'error' });
          io.to(roomId).emit('terminal:done',   { exitCode: 1, status: 'Compilation Error' });
          try { fsTerm.rmSync(tmpDir,{recursive:true,force:true}); } catch {}
          return;
        }
      }

      // Run
      const proc  = spawn(runArgs[0], runArgs[1], { stdio:['pipe','pipe','pipe'] });
      const timer = setTimeout(() => { proc.kill('SIGKILL'); }, 10000);

      // Store process per room for stdin
      if (!room?.termProcs) room.termProcs = new Map();
      room.termProcs.set(socket.id, proc);

      proc.stdout.on('data', d => {
        const text = d.toString();
        io.to(roomId).emit('terminal:output', { text, type: 'stdout' });
      });
      proc.stderr.on('data', d => {
        io.to(roomId).emit('terminal:output', { text: d.toString(), type: 'stderr' });
      });
      proc.on('close', code => {
        clearTimeout(timer);
        room.termProcs?.delete(socket.id);
        io.to(roomId).emit('terminal:done', {
          exitCode: code,
          status: code === 0 ? 'Accepted' : 'Runtime Error'
        });
        try { fsTerm.rmSync(tmpDir,{recursive:true,force:true}); } catch {}
      });

      // Send stdin if provided
      if (stdin) {
        proc.stdin.write(stdin.endsWith('\n') ? stdin : stdin + '\n');
        proc.stdin.end();
      }

    } catch(e) {
      io.to(roomId).emit('terminal:output', { text: e.message, type: 'error' });
      try { fsTerm.rmSync(tmpDir,{recursive:true,force:true}); } catch {}
    }
  });

  // Student/Tutor sends stdin to running process
  socket.on('terminal:stdin', ({ roomId, text }) => {
    const room = activeRooms.get(roomId);
    if (!room?.termProcs) return;
    // Find tutor's process
    const tutorProc = room.termProcs.get(room.tutorSocketId);
    if (tutorProc) {
      tutorProc.stdin.write(text.endsWith('\n') ? text : text + '\n');
      // Echo input to all
      io.to(roomId).emit('terminal:output', { text: text + '\n', type: 'stdin-echo' });
    }
  });

  // ── Shared Notepad ──────────────────────────────────────────────────────────
  socket.on('notepad:update', ({ roomId, content }) => {
    const room = activeRooms.get(roomId);
    if (!room) return;
    room.notepad = content;
    // Broadcast to all students (read-only)
    socket.to(roomId).emit('notepad:updated', { content });
  });

  socket.on('notepad:request', ({ roomId }) => {
    const room = activeRooms.get(roomId);
    if (room?.notepad) {
      socket.emit('notepad:updated', { content: room.notepad });
    }
  });

  // ── Live sync: language change ────────────────────────────────────────────
  socket.on('tutor:language-change', ({ roomId, language }) => {
    const room = activeRooms.get(roomId);
    if (room) room.language = language;
    socket.to(roomId).emit('language:changed', { language });
  });

  // Tutor broadcasts run output to all students (REST API fallback)
  socket.on('tutor:run-output', ({ roomId, output, error, status, language }) => {
    const room = activeRooms.get(roomId);
    if (!room) return;
    io.to(roomId).emit('run:output', { output, error, status, language });
  });

  // Tutor broadcasts run started
  socket.on('tutor:run-start', ({ roomId }) => {
    io.to(roomId).emit('run:started', {});
  });

  socket.on('tutor:code-change', ({ roomId, code, cursorPosition }) => {
    const room = activeRooms.get(roomId);
    if (!room) return;
    room.tutorCode = code;
    // Broadcast to everyone EXCEPT the tutor socket
    socket.to(roomId).emit('code:update', { code, cursorPosition });
  });

  // ── TUTOR changes language ────────────────────────────────────────────────
  socket.on('tutor:language-change', ({ roomId, language }) => {
    const room = activeRooms.get(roomId);
    if (!room) return;
    room.language = language;
    io.to(roomId).emit('language:change', { language });
  });

  // ── Chat message ─────────────────────────────────────────────────────────
  socket.on('session:message', (data) => {
    // Use socket.to() so sender does NOT receive their own message back
    socket.to(data.roomId).emit('session:message', { ...data, timestamp: new Date() });
  });

  // ── TUTOR ends session ────────────────────────────────────────────────────
  // ── Whiteboard broadcast ──────────────────────────────────────────────────
  // ── Student Code Monitor ────────────────────────────────────────────────────
  // Student sends their code to tutor in realtime
  socket.on('student:code-update', ({ roomId, studentId, studentName, code, language }) => {
    const room = activeRooms.get(roomId);
    if (!room) return;
    // Forward to tutor only
    if (room.tutorSocketId) {
      io.to(room.tutorSocketId).emit('monitor:student-code', {
        studentId, studentName, code, language, timestamp: new Date()
      });
    }
    // Store latest code in room for tutor joining late
    if (!room.studentCodes) room.studentCodes = new Map();
    room.studentCodes.set(studentId, { studentName, code, language, timestamp: new Date() });
  });

  // Tutor requests all current student codes
  socket.on('monitor:request-all', ({ roomId }) => {
    const room = activeRooms.get(roomId);
    if (!room || !room.studentCodes) return;
    const allCodes = [];
    room.studentCodes.forEach((val, studentId) => {
      allCodes.push({ studentId, ...val });
    });
    socket.emit('monitor:all-codes', allCodes);
  });

  socket.on('whiteboard:draw', ({ roomId, from, to, color, size, isErase }) => {
    socket.to(roomId).emit('whiteboard:draw', { from, to, color, size, isErase });
  });
  socket.on('whiteboard:clear', ({ roomId }) => {
    socket.to(roomId).emit('whiteboard:clear');
  });

  socket.on('tutor:end-session', ({ roomId }) => {
    io.to(roomId).emit('session:ended', { message: 'The tutor has ended the session.' });
    activeRooms.delete(roomId);
    console.log(`[room:${roomId}] Session ended`);
  });

  // ── List active rooms (for debugging / admin) ─────────────────────────────
  socket.on('get:active-rooms', () => {
    const rooms = [];
    activeRooms.forEach((data, roomId) => {
      rooms.push({ roomId, language: data.language, studentCount: data.students.size, tutorId: data.tutorId });
    });
    socket.emit('active:rooms', rooms);
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const { roomId, role, studentId, tutorId } = socket.data;
    if (!roomId) return;

    const room = activeRooms.get(roomId);
    if (!room) return;

    if (role === 'student') {
      room.students.delete(studentId);
      io.to(roomId).emit('student:left', { studentId, count: room.students.size });
    } else if (role === 'tutor') {
      // Mark tutor as disconnected (socket gone) but keep room alive briefly
      room.tutorSocketId = null;
      io.to(roomId).emit('tutor:disconnected', { message: 'Tutor connection interrupted. Waiting for reconnect...' });
      console.log(`[room:${roomId}] Tutor disconnected (room kept alive for reconnect)`);
    }
  });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';  // 0.0.0.0 = accessible on LAN
server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ╔════════════════════════════════════════╗');
  console.log('  ║   🖥️  CodeLab Server Running             ║');
  console.log(`  ║   http://localhost:${PORT}                 ║`);
  console.log('  ║   DB: NeDB (zero external deps)         ║');
  console.log('  ╚════════════════════════════════════════╝');
  console.log('');
});

module.exports = { app, io };
