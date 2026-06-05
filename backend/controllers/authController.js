const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { db, normalizeBusiness, normalizeUser } = require('../config/db');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const userWithFavorites = (row) => {
  const user = normalizeUser(row);
  if (!user) return null;
  user.favorites = db.prepare('SELECT business_id FROM favorites WHERE user_id = ?').all(user._id).map((item) => item.business_id);
  return user;
};

const register = async (req, res) => {
  const { name, email, password, phone, role = 'user' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
  if (!['user', 'owner'].includes(role)) return res.status(400).json({ message: 'Invalid role' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(400).json({ message: 'User already exists' });

  const id = randomUUID();
  const hashed = await bcrypt.hash(password, 10);
  db.prepare(`
    INSERT INTO users (id, name, email, password, phone, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, email.toLowerCase(), hashed, phone || '', role);

  const user = userWithFavorites(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  res.status(201).json({ ...user, token: generateToken(id) });
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase());
  if (!row || !(await bcrypt.compare(password || '', row.password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  if (row.is_blocked) {
    return res.status(403).json({ message: row.blocked_reason || 'User is blocked' });
  }

  const user = userWithFavorites(row);
  res.json({ ...user, token: generateToken(user._id) });
};

const getProfile = async (req, res) => {
  res.json(req.user);
};

const toggleFavorite = async (req, res) => {
  const businessId = req.params.id;
  const business = db.prepare('SELECT id FROM businesses WHERE id = ?').get(businessId);
  if (!business) return res.status(404).json({ message: 'Business not found' });

  const existing = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND business_id = ?').get(req.user._id, businessId);
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND business_id = ?').run(req.user._id, businessId);
  } else {
    db.prepare('INSERT INTO favorites (user_id, business_id) VALUES (?, ?)').run(req.user._id, businessId);
  }

  const favorites = db.prepare('SELECT business_id FROM favorites WHERE user_id = ?').all(req.user._id).map((item) => item.business_id);
  res.json({ favorites });
};

const getFavorites = async (req, res) => {
  const rows = db.prepare(`
    SELECT b.*, u.name AS owner_name, u.email AS owner_email, MIN(s.price) AS min_price
    FROM favorites f
    JOIN businesses b ON b.id = f.business_id
    LEFT JOIN users u ON u.id = b.owner_id
    LEFT JOIN services s ON s.business_id = b.id AND s.is_active = 1
    WHERE f.user_id = ?
    GROUP BY b.id
  `).all(req.user._id);
  res.json(rows.map(normalizeBusiness));
};

module.exports = { register, login, getProfile, toggleFavorite, getFavorites };
