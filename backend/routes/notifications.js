const express = require('express');
const { protect } = require('../middleware/auth');
const { db } = require('../config/db');

const router = express.Router();

const mapNotification = (row) => ({
  _id: row.id,
  type: row.type,
  title: row.title,
  message: row.message,
  isRead: Boolean(row.is_read),
  createdAt: row.created_at,
});

router.get('/', protect, async (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user._id);
  const unread = db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user._id).count;
  res.json({ unread, notifications: rows.map(mapNotification) });
});

// NOTE: /read-all must be registered BEFORE /:id/read to avoid Express
// matching the literal string "read-all" as the :id parameter.
router.patch('/read-all', protect, async (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user._id);
  res.json({ message: 'Notifications marked as read' });
});

router.patch('/:id/read', protect, async (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user._id);
  res.json({ message: 'Notification marked as read' });
});

module.exports = router;
