/**
 * db.js — MongoDB via Mongoose
 * MONGO_URI env variable set karo Railway mein
 */

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI environment variable not set!');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB connection failed:', err.message); process.exit(1); });

const User         = require('./models/User');
const Project      = require('./models/Project');
const Session      = require('./models/Session');

// NeDB-compatible API wrapper for MongoDB/Mongoose
const makeCollection = (Model) => ({
  // Find one
  findOne: (query) => Model.findOne(query).lean(),

  // Find many
  find: (query = {}) => ({
    lean: () => Model.find(query).lean(),
    exec: () => Model.find(query).lean(),
    sort: (s) => ({ lean: () => Model.find(query).sort(s).lean() }),
  }),

  // Insert
  insert: (data) => Array.isArray(data)
    ? Model.insertMany(data)
    : new Model(data).save().then(d => d.toObject()),

  // Update one
  update: (query, update, opts = {}) => {
    const mongoUpdate = update.$set ? update : { $set: update };
    if (opts.multi) return Model.updateMany(query, mongoUpdate);
    return Model.findOneAndUpdate(query, mongoUpdate, { new: true, upsert: opts.upsert || false }).lean();
  },

  // Remove
  remove: (query, opts = {}) => opts.multi
    ? Model.deleteMany(query)
    : Model.deleteOne(query),

  // Count
  count: (query = {}) => Model.countDocuments(query),

  // Ensure index (no-op for mongoose — handled in schema)
  ensureIndex: () => {},

  // Raw model access
  _model: Model,
});

const db = {
  users:         makeCollection(User),
  projects:      makeCollection(Project),
  sessions:      makeCollection(Session),
  tutorSnippets: makeCollection(require('./models/TutorSnippet')),
  batches:       makeCollection(require('./models/Batch')),
};

module.exports = db;
