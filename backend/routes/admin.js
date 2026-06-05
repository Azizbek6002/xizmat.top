const express = require('express');
const { randomUUID } = require('crypto');
const {
  getUnverifiedBusinesses,
  getAllBusinesses,
  verifyBusiness,
  rejectBusiness,
  blockBusiness,
  unblockBusiness,
  getStats,
  getAllReviews,
  deleteReview,
  getCategories,
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/auth');
const { db } = require('../config/db');

const router = express.Router();

router.get('/unverified-businesses', protect, admin, getUnverifiedBusinesses);
router.get('/businesses', protect, admin, getAllBusinesses);
router.get('/stats', protect, admin, getStats);
router.get('/reviews', protect, admin, getAllReviews);
router.delete('/reviews/:id', protect, admin, deleteReview);
router.get('/categories', protect, admin, getCategories);
router.patch('/verify-business/:id', protect, admin, verifyBusiness);
router.patch('/reject-business/:id', protect, admin, rejectBusiness);
router.patch('/block-business/:id', protect, admin, blockBusiness);
router.patch('/unblock-business/:id', protect, admin, unblockBusiness);

// ── Promoted Flash Deals (admin-controlled ads) ─────────────────────────────

// GET all promoted deals (public — used on Home page)
router.get('/promoted-deals', (req, res) => {
  const rows = db.prepare(`
    SELECT pd.*, s.name AS service_name, s.price, s.discount_price, s.flash_deal_ends_at,
           s.photo AS service_photo, s.is_flash_deal, s.is_active,
           b.id AS business_id, b.name AS business_name, b.photos AS business_photos,
           b.category, b.city, b.district, b.address
    FROM promoted_deals pd
    JOIN services s ON s.id = pd.service_id
    JOIN businesses b ON b.id = s.business_id
    WHERE b.status = 'approved' AND s.is_active = 1
      AND (pd.expires_at IS NULL OR pd.expires_at > datetime('now'))
    ORDER BY pd.priority DESC, pd.created_at DESC
    LIMIT 12
  `).all();

  const result = rows.map(r => ({
    _id: r.id,
    title: r.title || r.service_name,
    bannerImage: r.banner_image || '',
    priority: r.priority,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    service: {
      _id: r.service_id,
      name: r.service_name,
      price: Number(r.price || 0),
      discountPrice: r.discount_price ? Number(r.discount_price) : null,
      flashDealEndsAt: r.flash_deal_ends_at || null,
      photo: r.service_photo || '',
      isFlashDeal: Boolean(r.is_flash_deal),
      percentOff: r.discount_price
        ? Math.round((1 - Number(r.discount_price) / Number(r.price)) * 100)
        : 0,
      effectivePrice: r.discount_price ? Number(r.discount_price) : Number(r.price),
    },
    business: {
      _id: r.business_id,
      name: r.business_name,
      photos: (() => { try { return JSON.parse(r.business_photos); } catch { return []; } })(),
      category: r.category,
      city: r.city,
      district: r.district,
      address: r.address,
    },
  }));
  res.json(result);
});

// GET all promoted deals for admin management
router.get('/promoted-deals/manage', protect, admin, (req, res) => {
  const rows = db.prepare(`
    SELECT pd.*, s.name AS service_name, s.price, s.discount_price,
           b.name AS business_name
    FROM promoted_deals pd
    JOIN services s ON s.id = pd.service_id
    JOIN businesses b ON b.id = s.business_id
    ORDER BY pd.priority DESC, pd.created_at DESC
  `).all();
  res.json(rows);
});

// POST create promoted deal
router.post('/promoted-deals', protect, admin, (req, res) => {
  const { serviceId, title = '', bannerImage = '', priority = 0, expiresAt = null } = req.body;
  if (!serviceId) return res.status(400).json({ message: 'serviceId is required' });

  const service = db.prepare('SELECT id FROM services WHERE id = ?').get(serviceId);
  if (!service) return res.status(404).json({ message: 'Service not found' });

  const id = randomUUID();
  db.prepare(`
    INSERT INTO promoted_deals (id, service_id, title, banner_image, priority, created_by, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, serviceId, title.trim(), bannerImage.trim(), Number(priority), req.user._id, expiresAt || null);

  res.status(201).json({ _id: id, message: 'Promoted deal created' });
});

// DELETE promoted deal
router.delete('/promoted-deals/:id', protect, admin, (req, res) => {
  const row = db.prepare('SELECT id FROM promoted_deals WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Not found' });
  db.prepare('DELETE FROM promoted_deals WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// PATCH update priority / expiry
router.patch('/promoted-deals/:id', protect, admin, (req, res) => {
  const { priority, expiresAt, title, bannerImage } = req.body;
  const row = db.prepare('SELECT * FROM promoted_deals WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Not found' });

  db.prepare(`
    UPDATE promoted_deals SET
      priority = ?, expires_at = ?, title = ?, banner_image = ?
    WHERE id = ?
  `).run(
    priority !== undefined ? Number(priority) : row.priority,
    expiresAt !== undefined ? expiresAt : row.expires_at,
    title !== undefined ? title : row.title,
    bannerImage !== undefined ? bannerImage : row.banner_image,
    req.params.id,
  );
  res.json({ message: 'Updated' });
});

module.exports = router;
