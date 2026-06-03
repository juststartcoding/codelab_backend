/**
 * db.js — NeDB database layer
 * Pure JavaScript in-memory + file-persisted database.
 * No MongoDB installation required.
 * API mirrors Mongoose for easy future migration.
 */

const Datastore = require('nedb-promises');
const path = require('path');
const fs = require('fs');

// Create data directory for persistence
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = {
  users:         Datastore.create({ filename: path.join(DATA_DIR, 'users.db'),         autoload: true }),
  projects:      Datastore.create({ filename: path.join(DATA_DIR, 'projects.db'),      autoload: true }),
  sessions:      Datastore.create({ filename: path.join(DATA_DIR, 'sessions.db'),      autoload: true }),
  tutorSnippets: Datastore.create({ filename: path.join(DATA_DIR, 'tutorSnippets.db'), autoload: true }),
  batches:       Datastore.create({ filename: path.join(DATA_DIR, 'batches.db'),       autoload: true }),
};

// Ensure unique index on email for users
db.users.ensureIndex({ fieldName: 'email', unique: true });

module.exports = db;
