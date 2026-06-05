const express = require('express');
const { randomUUID } = require('crypto');
const { protect } = require('../middleware/auth');
const { db } = require('../config/db');

const router = express.Router();

const createNotification = (userId, title, message) => {
  db.prepare('INSERT INTO notifications (id, user_id, type, title, message) VALUES (?, ?, ?, ?, ?)')
    .run(randomUUID(), userId, 'chat_message', title, message);
};

const mapConversation = (row) => ({
  _id: row.id,
  business: { _id: row.business_id, name: row.business_name, photos: row.business_photos ? JSON.parse(row.business_photos || '[]') : [] },
  user: { _id: row.user_id, name: row.user_name, email: row.user_email },
  owner: { _id: row.owner_id, name: row.owner_name, email: row.owner_email },
  lastMessage: row.last_message || '',
  unreadCount: row.unread_count || 0,
  updatedAt: row.updated_at,
});

const mapMessage = (row) => ({
  _id: row.id,
  conversationId: row.conversation_id,
  sender: { _id: row.sender_id, name: row.sender_name },
  body: row.body,
  isRead: Boolean(row.is_read),
  createdAt: row.created_at,
});

router.get('/conversations', protect, async (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, b.name AS business_name, b.photos AS business_photos,
      u.name AS user_name, u.email AS user_email,
      o.name AS owner_name, o.email AS owner_email,
      (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != @currentUser AND m.is_read = 0) AS unread_count
    FROM conversations c
    JOIN businesses b ON b.id = c.business_id
    JOIN users u ON u.id = c.user_id
    JOIN users o ON o.id = c.owner_id
    WHERE c.user_id = @currentUser OR c.owner_id = @currentUser
    ORDER BY c.updated_at DESC
  `).all({ currentUser: req.user._id });
  res.json(rows.map(mapConversation));
});

router.post('/conversations', protect, async (req, res) => {
  const { businessId } = req.body;
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!business) return res.status(404).json({ message: 'Business not found' });
  if (business.owner_id === req.user._id) return res.status(400).json({ message: 'Owner cannot start chat with own business' });

  let conversation = db.prepare('SELECT * FROM conversations WHERE business_id = ? AND user_id = ?').get(businessId, req.user._id);
  if (!conversation) {
    const id = randomUUID();
    db.prepare('INSERT INTO conversations (id, business_id, user_id, owner_id) VALUES (?, ?, ?, ?)')
      .run(id, businessId, req.user._id, business.owner_id);
    conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  }
  res.status(201).json({ _id: conversation.id });
});

router.get('/conversations/:id/messages', protect, async (req, res) => {
  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
  if (conversation.user_id !== req.user._id && conversation.owner_id !== req.user._id) return res.status(403).json({ message: 'Not authorized' });

  db.prepare('UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ?').run(req.params.id, req.user._id);
  const rows = db.prepare(`
    SELECT m.*, u.name AS sender_name
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
  `).all(req.params.id);
  res.json(rows.map(mapMessage));
});

router.post('/conversations/:id/messages', protect, async (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ message: 'Message text is required' });

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
  if (conversation.user_id !== req.user._id && conversation.owner_id !== req.user._id) return res.status(403).json({ message: 'Not authorized' });

  const id = randomUUID();
  db.prepare('INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)')
    .run(id, req.params.id, req.user._id, body.trim());
  db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

  const recipientId = req.user._id === conversation.user_id ? conversation.owner_id : conversation.user_id;
  createNotification(recipientId, 'New message', body.trim().slice(0, 120));

  const row = db.prepare(`
    SELECT m.*, u.name AS sender_name
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.id = ?
  `).get(id);
  res.status(201).json(mapMessage(row));
});

module.exports = router;
