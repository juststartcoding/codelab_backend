/**
 * db.js — MongoDB via Mongoose
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('❌ MONGO_URI not set'); process.exit(1); }

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB connection failed:', err.message); process.exit(1); });

const User         = require('./models/User');
const Project      = require('./models/Project');
const Session      = require('./models/Session');
const TutorSnippet = require('./models/TutorSnippet');
const Batch        = require('./models/Batch');

const makeCollection = (Model) => ({

  // findOne — password field explicitly include karo
  findOne: (query) => Model.findOne(query).select('+password').lean(),

  // find
  find: (query = {}) => ({
    lean:  ()  => Model.find(query).lean(),
    exec:  ()  => Model.find(query).lean(),
    sort:  (s) => ({ lean: () => Model.find(query).sort(s).lean() }),
  }),

  // insert
  insert: async (data) => {
    if (Array.isArray(data)) return Model.insertMany(data);
    const doc = await new Model(data).save();
    return doc.toObject({ getters: true });
  },

  // update
  update: (query, update, opts = {}) => {
    const mongoUpdate = update.$set ? update : { $set: update };
    if (opts.multi) return Model.updateMany(query, mongoUpdate);
    return Model.findOneAndUpdate(query, mongoUpdate, { new: true, upsert: opts.upsert || false }).lean();
  },

  // remove
  remove: (query, opts = {}) => opts.multi
    ? Model.deleteMany(query)
    : Model.deleteOne(query),

  // count
  count: (query = {}) => Model.countDocuments(query),

  ensureIndex: () => {},

  _model: Model,
});

module.exports = {
  users:         makeCollection(User),
  projects:      makeCollection(Project),
  sessions:      makeCollection(Session),
  tutorSnippets: makeCollection(TutorSnippet),
  batches:       makeCollection(Batch),
};
