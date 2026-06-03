/**
 * CodeLab Database Seeder — MongoDB version
 * Run: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { hashPassword } = require('./helpers');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('❌ MONGO_URI not set'); process.exit(1); }

const mkId = () => new mongoose.Types.ObjectId();

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('\n🌱 Seeding CodeLab database (MongoDB)...\n');

  const User    = require('./models/User');
  const Project = require('./models/Project');
  const Session = require('./models/Session');

  // Clear existing data
  await User.deleteMany({});
  await Project.deleteMany({});
  await Session.deleteMany({});

  // ── Admin ──────────────────────────────────────────────────────────────
  const admin = await User.create({
    name: 'CodeLab Admin', email: 'admin@codelab.dev',
    password: await hashPassword('admin123'),
    role: 'admin', isApproved: true, bio: 'Platform administrator',
    languages: [],
  });

  // ── Tutors ─────────────────────────────────────────────────────────────
  const tutor1 = await User.create({
    name: 'Dr. Sarah Johnson', email: 'sarah@codelab.dev',
    password: await hashPassword('tutor123'),
    role: 'tutor', isApproved: true,
    bio: '10+ years C/C++ systems programming and embedded development',
    languages: ['c', 'cpp', 'python'],
  });

  const tutor2 = await User.create({
    name: 'Prof. Michael Chen', email: 'michael@codelab.dev',
    password: await hashPassword('tutor123'),
    role: 'tutor', isApproved: true,
    bio: 'CS professor specializing in algorithms and data structures',
    languages: ['c', 'cpp', 'java'],
  });

  // ── Students ───────────────────────────────────────────────────────────
  const student1 = await User.create({
    name: 'Alice Patel', email: 'alice@student.dev',
    password: await hashPassword('student123'),
    role: 'student', isApproved: true, languages: [],
  });

  const student2 = await User.create({
    name: 'Bob Kumar', email: 'bob@student.dev',
    password: await hashPassword('student123'),
    role: 'student', isApproved: true, languages: [],
  });

  // ── Projects ───────────────────────────────────────────────────────────
  await Project.create({
    name: 'Prime Numbers in C',
    description: 'Find and display prime numbers using efficient algorithm',
    studentId: student1._id, language: 'c',
    files: [{
      _id: mkId(), name: 'main.c', language: 'c',
      content: `#include <stdio.h>\n#include <math.h>\n\nint isPrime(int n) {\n    if (n < 2) return 0;\n    for (int i = 2; i <= (int)sqrt(n); i++)\n        if (n % i == 0) return 0;\n    return 1;\n}\n\nint main() {\n    printf("Prime numbers from 1 to 50:\\n");\n    for (int i = 1; i <= 50; i++)\n        if (isPrime(i)) printf("%d ", i);\n    printf("\\n");\n    return 0;\n}`,
    }],
    comments: [{
      _id: mkId(), tutorId: tutor1._id, tutorName: 'Dr. Sarah Johnson',
      lineNumber: 5, comment: 'Great use of sqrt optimization!',
    }],
    isSubmitted: true, grade: 'A',
    tutorFeedback: 'Excellent work Alice! Your isPrime function is efficient.',
  });

  await Project.create({
    name: 'Hello World C', description: 'My first C program',
    studentId: student2._id, language: 'c',
    files: [{ _id: mkId(), name: 'hello.c', language: 'c', content: `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n` }],
    comments: [], isSubmitted: false, grade: '', tutorFeedback: '',
  });

  // ── Session ────────────────────────────────────────────────────────────
  await Session.create({
    title: 'Introduction to Pointers in C',
    tutorId: tutor1._id, tutorName: tutor1.name,
    roomId: 'DEMO0001', language: 'c',
    description: 'Learn how pointers work in C',
    isActive: false,
    startedAt: new Date(Date.now() - 86400000),
    endedAt:   new Date(Date.now() - 82800000),
    participants: [],
    codeSnapshot: `#include <stdio.h>\n\nint main() {\n    int x = 42;\n    int *ptr = &x;\n    printf("Value: %d\\n", *ptr);\n    return 0;\n}`,
  });

  console.log('✅ All data inserted!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 LOGIN CREDENTIALS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚙️  Admin   → admin@codelab.dev   / admin123   → /login/admin');
  console.log('👨‍🏫 Tutor 1 → sarah@codelab.dev   / tutor123   → /login/tutor');
  console.log('👨‍🏫 Tutor 2 → michael@codelab.dev / tutor123   → /login/tutor');
  console.log('👨‍💻 Student → alice@student.dev   / student123 → /login/student');
  console.log('👨‍💻 Student → bob@student.dev     / student123 → /login/student');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
