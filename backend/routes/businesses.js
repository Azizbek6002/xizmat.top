const express = require('express');
const { randomUUID } = require('crypto');
const { getBusinesses, getMyBusinesses, getBusinessById, createBusiness, updateBusiness, deleteBusiness } = require('../controllers/businessController');
const { getServicesByBusiness } = require('../controllers/serviceController');
const { protect, owner } = require('../middleware/auth');
const { db } = require('../config/db');

const router = express.Router();

router.get('/', getBusinesses);
router.get('/my', protect, owner, getMyBusinesses);
router.get('/:id/services', getServicesByBusiness);
router.get('/:id', getBusinessById);
router.post('/', protect, owner, createBusiness);
router.put('/:id', protect, owner, updateBusiness);
router.delete('/:id', protect, owner, deleteBusiness);

// ── Reviews ──────────────────────────────────────────────────────────────────

// POST /api/businesses/:id/reviews  — create or update the caller's review
router.post('/:id/reviews', protect, (req, res) => {
  const { rating, comment = '' } = req.body;
  const ratingNum = Number(rating);
  if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }

  const businessRow = db.prepare('SELECT id FROM businesses WHERE id = ?').get(req.params.id);
  if (!businessRow) return res.status(404).json({ message: 'Business not found' });

  // Check if user already has a review for this business
  const existing = db.prepare('SELECT id FROM reviews WHERE user_id = ? AND business_id = ?')
    .get(req.user._id, req.params.id);

  if (existing) {
    // Update existing review
    db.prepare('UPDATE reviews SET rating = ?, comment = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(ratingNum, comment.trim(), existing.id);
  } else {
    // Insert new review
    db.prepare('INSERT INTO reviews (id, user_id, business_id, rating, comment) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), req.user._id, req.params.id, ratingNum, comment.trim());
  }

  // Recalculate and persist the business rating + review_count
  const stats = db.prepare(
    'SELECT AVG(rating) AS avg_rating, COUNT(*) AS cnt FROM reviews WHERE business_id = ?'
  ).get(req.params.id);
  db.prepare('UPDATE businesses SET rating = ?, review_count = ? WHERE id = ?')
    .run(Number((stats.avg_rating || 0).toFixed(2)), stats.cnt, req.params.id);

  // Return the new review row
  const reviewRow = db.prepare(`
    SELECT r.id AS _id, r.rating, r.comment, r.created_at AS createdAt,
           u.id AS user_id, u.name AS user_name, u.avatar AS user_avatar
    FROM reviews r
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.user_id = ? AND r.business_id = ?
  `).get(req.user._id, req.params.id);

  res.status(existing ? 200 : 201).json({
    _id: reviewRow._id,
    rating: reviewRow.rating,
    comment: reviewRow.comment,
    createdAt: reviewRow.createdAt,
    user: { _id: reviewRow.user_id, name: reviewRow.user_name, avatar: reviewRow.user_avatar },
  });
});

module.exports = router;
