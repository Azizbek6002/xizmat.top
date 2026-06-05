const { randomUUID } = require('crypto');
const { db, normalizeBusiness, normalizeService } = require('../config/db');

const isFlashActive = (service) => (
  service.isFlashDeal && service.discountPrice !== null && service.flashDealEndsAt && new Date(service.flashDealEndsAt) > new Date()
);

const getServicesByBusiness = async (req, res) => {
  const services = db.prepare('SELECT * FROM services WHERE business_id = ? AND is_active = 1 ORDER BY price ASC').all(req.params.id);
  res.json(services.map(normalizeService));
};

const getFlashDeals = async (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, b.id AS b_id, b.owner_id, b.name AS b_name, b.description AS b_description, b.category AS b_category,
      b.city AS b_city, b.district AS b_district, b.address AS b_address, b.lat AS b_lat, b.lng AS b_lng,
      b.photos AS b_photos, b.amenities AS b_amenities, b.working_hours AS b_working_hours,
      b.contacts AS b_contacts, b.rating AS b_rating, b.review_count AS b_review_count,
      b.status AS b_status, b.vr_tour_url AS b_vr_tour_url, b.vr_preview_image AS b_vr_preview_image,
      b.business_type AS b_business_type
    FROM services s
    JOIN businesses b ON b.id = s.business_id
    WHERE s.is_active = 1 AND s.is_flash_deal = 1 AND s.discount_price IS NOT NULL
      AND s.flash_deal_ends_at > datetime('now') AND b.status = 'approved'
    ORDER BY s.flash_deal_ends_at ASC
  `).all();

  const results = rows.map((row) => {
    const service = normalizeService(row);
    const business = normalizeBusiness({
      id: row.b_id,
      owner_id: row.owner_id,
      name: row.b_name,
      description: row.b_description,
      category: row.b_category,
      city: row.b_city,
      district: row.b_district,
      address: row.b_address,
      lat: row.b_lat,
      lng: row.b_lng,
      photos: row.b_photos,
      amenities: row.b_amenities,
      working_hours: row.b_working_hours,
      contacts: row.b_contacts,
      rating: row.b_rating,
      review_count: row.b_review_count,
      status: row.b_status,
      vr_tour_url: row.b_vr_tour_url,
      vr_preview_image: row.b_vr_preview_image,
      business_type: row.b_business_type,
    });
    const percentOff = Math.round((1 - service.discountPrice / service.price) * 100);
    return {
      ...service,
      effectivePrice: service.discountPrice,
      percentOff,
      business,
    };
  });

  res.json(results);
};

const createService = async (req, res) => {
  const { businessId, name, description = '', price, durationMinutes = 60, isFlashDeal, discountPrice, flashDealEndsAt, photo = '' } = req.body;
  if (!businessId || !name || price === undefined) return res.status(400).json({ message: 'businessId, name and price are required' });

  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!business) return res.status(404).json({ message: 'Business not found' });
  if (business.owner_id !== req.user._id && req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });

  const id = randomUUID();
  db.prepare(`
    INSERT INTO services (id, business_id, name, description, price, duration_minutes, is_flash_deal, discount_price, flash_deal_ends_at, photo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, businessId, name, description, Number(price), Number(durationMinutes), isFlashDeal ? 1 : 0, discountPrice ? Number(discountPrice) : null, flashDealEndsAt || null, photo);

  res.status(201).json(normalizeService(db.prepare('SELECT * FROM services WHERE id = ?').get(id)));
};

const updateService = async (req, res) => {
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!service) return res.status(404).json({ message: 'Service not found' });
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(service.business_id);
  if (!business) return res.status(404).json({ message: 'Business not found' });
  if (business.owner_id !== req.user._id && req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });

  const current = normalizeService(service);
  const next = {
    id: req.params.id,
    name: req.body.name ?? current.name,
    description: req.body.description ?? current.description,
    price: req.body.price !== undefined ? Number(req.body.price) : current.price,
    durationMinutes: req.body.durationMinutes !== undefined ? Number(req.body.durationMinutes) : current.durationMinutes,
    isActive: req.body.isActive !== undefined ? (req.body.isActive ? 1 : 0) : (current.isActive ? 1 : 0),
    isFlashDeal: req.body.isFlashDeal !== undefined ? (req.body.isFlashDeal ? 1 : 0) : (current.isFlashDeal ? 1 : 0),
    discountPrice: req.body.discountPrice !== undefined ? (req.body.discountPrice ? Number(req.body.discountPrice) : null) : current.discountPrice,
    flashDealEndsAt: req.body.flashDealEndsAt !== undefined ? (req.body.flashDealEndsAt || null) : current.flashDealEndsAt,
    photo: req.body.photo ?? current.photo,
  };

  if (!next.isFlashDeal) {
    next.discountPrice = null;
    next.flashDealEndsAt = null;
  }

  db.prepare(`
    UPDATE services SET
      name = @name, description = @description, price = @price, duration_minutes = @durationMinutes,
      is_active = @isActive, is_flash_deal = @isFlashDeal, discount_price = @discountPrice,
      flash_deal_ends_at = @flashDealEndsAt, photo = @photo
    WHERE id = @id
  `).run(next);

  res.json(normalizeService(db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id)));
};

const deleteService = async (req, res) => {
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!service) return res.status(404).json({ message: 'Service not found' });
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(service.business_id);
  if (!business) return res.status(404).json({ message: 'Business not found' });
  if (business.owner_id !== req.user._id && req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });

  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  res.json({ message: 'Service deleted' });
};

module.exports = { getServicesByBusiness, getFlashDeals, createService, updateService, deleteService, isFlashActive };
