const express = require('express');
const { protect, admin } = require('../middleware/auth');
const { db, normalizeUser } = require('../config/db');

const router = express.Router();

router.get('/', protect, admin, async (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(normalizeUser);
  res.json(users);
});

router.patch('/:id/block', protect, admin, async (req, res) => {
  db.prepare('UPDATE users SET is_blocked = 1, blocked_reason = ? WHERE id = ?').run(req.body.reason || '', req.params.id);
  res.json(normalizeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)));
});

router.patch('/:id/unblock', protect, admin, async (req, res) => {
  db.prepare("UPDATE users SET is_blocked = 0, blocked_reason = '' WHERE id = ?").run(req.params.id);
  res.json(normalizeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)));
});

router.patch('/:id/role', protect, admin, async (req, res) => {
  if (!['user', 'owner', 'admin'].includes(req.body.role)) return res.status(400).json({ message: 'Invalid role' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(req.body.role, req.params.id);
  res.json(normalizeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)));
});

module.exports = router;
