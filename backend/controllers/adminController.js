const { db, normalizeBusiness, normalizeUser } = require('../config/db');

const getUnverifiedBusinesses = async (req, res) => {
  const rows = db.prepare(`
    SELECT b.*, u.name AS owner_name, u.email AS owner_email
    FROM businesses b
    LEFT JOIN users u ON u.id = b.owner_id
    WHERE b.status = 'pending'
    ORDER BY b.created_at DESC
  `).all();
  res.json(rows.map(normalizeBusiness));
};

const getAllBusinesses = async (req, res) => {
  const rows = db.prepare(`
    SELECT b.*, u.name AS owner_name, u.email AS owner_email, MIN(s.price) AS min_price
    FROM businesses b
    LEFT JOIN users u ON u.id = b.owner_id
    LEFT JOIN services s ON s.business_id = b.id AND s.is_active = 1
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `).all();
  res.json(rows.map(normalizeBusiness));
};

const setBusinessStatus = (status) => async (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!business) return res.status(404).json({ message: 'Business not found' });
  db.prepare('UPDATE businesses SET status = ?, rejection_reason = ?, blocked_reason = ? WHERE id = ?')
    .run(status, req.body.reason || '', req.body.reason || '', req.params.id);
  db.prepare('INSERT INTO notifications (id, user_id, type, title, message) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)')
    .run(business.owner_id, `business_${status}`, 'Business status updated', `Your business status is now ${status}.`);
  res.json(normalizeBusiness(db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id)));
};

const getStats = async (req, res) => {
  const one = (sql) => db.prepare(sql).get().count;
  res.json({
    users: one('SELECT COUNT(*) AS count FROM users'),
    businesses: one('SELECT COUNT(*) AS count FROM businesses'),
    pendingBusinesses: one("SELECT COUNT(*) AS count FROM businesses WHERE status = 'pending'"),
    bookings: one('SELECT COUNT(*) AS count FROM bookings'),
    reviews: one('SELECT COUNT(*) AS count FROM reviews'),
  });
};

const getAllReviews = async (req, res) => {
  const rows = db.prepare(`
    SELECT r.id AS _id, r.rating, r.comment, r.created_at AS createdAt,
      u.id AS user_id, u.name AS user_name, b.id AS business_id, b.name AS business_name
    FROM reviews r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN businesses b ON b.id = r.business_id
    ORDER BY r.created_at DESC
  `).all();
  res.json(rows.map((row) => ({
    _id: row._id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt,
    user: { _id: row.user_id, name: row.user_name },
    business: { _id: row.business_id, name: row.business_name },
  })));
};

const deleteReview = async (req, res) => {
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ message: 'Review deleted' });
};

const getCategories = async (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name_en').all());
};

module.exports = {
  getUnverifiedBusinesses,
  getAllBusinesses,
  verifyBusiness: setBusinessStatus('approved'),
  rejectBusiness: setBusinessStatus('rejected'),
  blockBusiness: setBusinessStatus('blocked'),
  unblockBusiness: setBusinessStatus('approved'),
  getStats,
  getAllReviews,
  deleteReview,
  getCategories,
};
