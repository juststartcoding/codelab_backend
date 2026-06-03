const { verifyToken } = require('../helpers');
const db = require('../db');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = verifyToken(token);
    const user = await db.users.findOne({ _id: decoded.id });
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ message: `Access denied. Required: ${roles.join(' or ')}` });
  next();
};

module.exports = { auth, requireRole };
