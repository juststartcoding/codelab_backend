/**
 * helpers.js — Shared utilities for NeDB-based routes
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'codelab_secret_key_2024';

const signToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });

const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

const hashPassword = (pw) => bcrypt.hash(pw, 12);

const comparePassword = (pw, hash) => bcrypt.compare(pw, hash);

const stripPassword = (user) => {
  const { password, ...rest } = user;
  return rest;
};

// Generate a random 8-char room ID like "AB12CD34"
const makeRoomId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const getDefaultContent = (language) => {
  const templates = {
    c:          '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
    cpp:        '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n',
    python:     '# Python Program\nprint("Hello, World!")\n',
    java:       'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
    javascript: '// JavaScript Program\nconsole.log("Hello, World!");\n',
  };
  return templates[language] || templates.c;
};

module.exports = { signToken, verifyToken, hashPassword, comparePassword, stripPassword, makeRoomId, getDefaultContent };
