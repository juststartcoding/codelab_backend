/**
 * CodeLab Database Seeder (NeDB version)
 * Run: node seed.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Clear old data files before requiring db
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
['users.db', 'projects.db', 'sessions.db'].forEach(f => {
  fs.writeFileSync(path.join(DATA_DIR, f), '');
});

const db = require('./db');
const { hashPassword, makeRoomId } = require('./helpers');

const mkId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

async function seed() {
  console.log('\n🌱 Seeding CodeLab database (NeDB)...\n');

  // Wait a moment for NeDB to load the now-empty files
  await new Promise(r => setTimeout(r, 300));

  // ── Admin ────────────────────────────────────────────────────────────────
  const admin = await db.users.insert({
    name: 'CodeLab Admin', email: 'admin@codelab.dev',
    password: await hashPassword('admin123'),
    role: 'admin', isApproved: true, bio: 'Platform administrator',
    languages: [], createdAt: new Date(), lastLogin: null,
  });

  // ── Tutors ───────────────────────────────────────────────────────────────
  const tutor1 = await db.users.insert({
    name: 'Dr. Sarah Johnson', email: 'sarah@codelab.dev',
    password: await hashPassword('tutor123'),
    role: 'tutor', isApproved: true,
    bio: '10+ years C/C++ systems programming and embedded development',
    languages: ['c', 'cpp', 'python'], createdAt: new Date(), lastLogin: null,
  });

  const tutor2 = await db.users.insert({
    name: 'Prof. Michael Chen', email: 'michael@codelab.dev',
    password: await hashPassword('tutor123'),
    role: 'tutor', isApproved: true,
    bio: 'CS professor specializing in algorithms and data structures',
    languages: ['c', 'cpp', 'java'], createdAt: new Date(), lastLogin: null,
  });

  // ── Students ─────────────────────────────────────────────────────────────
  const student1 = await db.users.insert({
    name: 'Alice Patel', email: 'alice@student.dev',
    password: await hashPassword('student123'),
    role: 'student', isApproved: true,
    languages: [], createdAt: new Date(), lastLogin: null,
  });

  const student2 = await db.users.insert({
    name: 'Bob Kumar', email: 'bob@student.dev',
    password: await hashPassword('student123'),
    role: 'student', isApproved: true,
    languages: [], createdAt: new Date(), lastLogin: null,
  });

  // ── Projects for Alice ───────────────────────────────────────────────────
  await db.projects.insert({
    name: 'Prime Numbers in C',
    description: 'Find and display prime numbers using efficient algorithm',
    studentId: student1._id, language: 'c',
    files: [
      {
        _id: mkId(), name: 'main.c', language: 'c',
        createdAt: new Date(), updatedAt: new Date(),
        content: `#include <stdio.h>
#include <math.h>

int isPrime(int n) {
    if (n < 2) return 0;
    for (int i = 2; i <= (int)sqrt(n); i++)
        if (n % i == 0) return 0;
    return 1;
}

int main() {
    printf("Prime numbers from 1 to 50:\\n");
    for (int i = 1; i <= 50; i++)
        if (isPrime(i)) printf("%d ", i);
    printf("\\n");
    return 0;
}`,
      },
      {
        _id: mkId(), name: 'utils.c', language: 'c',
        createdAt: new Date(), updatedAt: new Date(),
        content: `#include <stdio.h>\n\nvoid printHeader() {\n    printf("=== Prime Finder ===\\n");\n}\n`,
      },
    ],
    comments: [{
      _id: mkId(), tutorId: tutor1._id, tutorName: 'Dr. Sarah Johnson',
      fileId: null, lineNumber: 5,
      comment: 'Great use of sqrt optimization! This makes the function O(√n) instead of O(n).',
      createdAt: new Date(),
    }],
    isSubmitted: true,
    grade: 'A',
    tutorFeedback: 'Excellent work Alice! Your isPrime function is efficient. Consider adding user input for the range.',
    lastEditedBy: null, createdAt: new Date(), updatedAt: new Date(),
  });

  await db.projects.insert({
    name: 'Stack Implementation C++',
    description: 'Custom stack data structure using C++ classes and templates',
    studentId: student1._id, language: 'cpp',
    files: [
      {
        _id: mkId(), name: 'stack.cpp', language: 'cpp',
        createdAt: new Date(), updatedAt: new Date(),
        content: `#include <iostream>
#include <vector>
#include <stdexcept>
using namespace std;

template<typename T>
class Stack {
private:
    vector<T> data;
public:
    void push(T val) { data.push_back(val); }

    T pop() {
        if (data.empty()) throw runtime_error("Stack underflow");
        T val = data.back();
        data.pop_back();
        return val;
    }

    T top() const {
        if (data.empty()) throw runtime_error("Stack is empty");
        return data.back();
    }

    bool empty() const { return data.empty(); }
    size_t size() const { return data.size(); }
};

int main() {
    Stack<int> s;
    for (int i = 1; i <= 5; i++) s.push(i * 10);

    cout << "Stack (LIFO order): ";
    while (!s.empty()) cout << s.pop() << " ";
    cout << endl;
    return 0;
}`,
      },
    ],
    comments: [],
    isSubmitted: false, grade: '', tutorFeedback: '',
    lastEditedBy: null, createdAt: new Date(), updatedAt: new Date(),
  });

  // ── Projects for Bob ─────────────────────────────────────────────────────
  await db.projects.insert({
    name: 'Hello World C',
    description: 'My very first C program',
    studentId: student2._id, language: 'c',
    files: [{
      _id: mkId(), name: 'hello.c', language: 'c',
      createdAt: new Date(), updatedAt: new Date(),
      content: `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n`,
    }],
    comments: [], isSubmitted: false, grade: '', tutorFeedback: '',
    lastEditedBy: null, createdAt: new Date(), updatedAt: new Date(),
  });

  // ── Sample past session ──────────────────────────────────────────────────
  await db.sessions.insert({
    title: 'Introduction to Pointers in C',
    tutorId: tutor1._id, tutorName: tutor1.name,
    roomId: 'DEMO0001', language: 'c',
    description: 'Learn how pointers work in C — addresses, dereferencing, and pointer arithmetic',
    isActive: false,
    startedAt: new Date(Date.now() - 86400000),
    endedAt: new Date(Date.now() - 82800000),
    participants: [], createdAt: new Date(),
    codeSnapshot: `#include <stdio.h>\n\nint main() {\n    int x = 42;\n    int *ptr = &x;\n    printf("Value: %d\\n", *ptr);\n    printf("Address: %p\\n", (void*)ptr);\n    *ptr = 100;\n    printf("Modified: %d\\n", x);\n    return 0;\n}`,
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

  process.exit(0);
}

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
