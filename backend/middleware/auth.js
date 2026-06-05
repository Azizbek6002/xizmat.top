const jwt = require('jsonwebtoken');
const { db, normalizeUser } = require('../config/db');

const jwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return process.env.JWT_SECRET;
};

const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret());
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    const user = normalizeUser(row);

    if (!user) return res.status(401).json({ message: 'Not authorized, user not found' });
    if (user.isBlocked) return res.status(403).json({ message: 'User is blocked' });

    const favorites = db.prepare('SELECT business_id FROM favorites WHERE user_id = ?').all(user._id);
    user.favorites = favorites.map((favorite) => favorite.business_id);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Not authorized as admin' });
};

const owner = (req, res, next) => {
  if (req.user && (req.user.role === 'owner' || req.user.role === 'admin')) return next();
  return res.status(403).json({ message: 'Not authorized as owner' });
};

module.exports = { protect, admin, owner };
