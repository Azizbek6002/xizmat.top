const { randomUUID } = require('crypto');
const { db, normalizeBusiness, normalizeService, json } = require('../config/db');

const calcDistanceKm = (lat1, lng1, lat2, lng2) => {
  const r = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const baseBusinessQuery = `
  SELECT b.*, u.name AS owner_name, u.email AS owner_email, MIN(s.price) AS min_price
  FROM businesses b
  LEFT JOIN users u ON u.id = b.owner_id
  LEFT JOIN services s ON s.business_id = b.id AND s.is_active = 1
`;

const getBusinesses = async (req, res) => {
  const { lat, lng, radius = 10, category, city, district, search, includeAll } = req.query;
  const clauses = [];
  const params = {};

  if (includeAll !== 'true') clauses.push("b.status = 'approved'");
  if (category) { clauses.push('b.category = @category'); params.category = category; }
  if (city) { clauses.push('LOWER(b.city) LIKE LOWER(@city)'); params.city = `%${city}%`; }
  if (district) { clauses.push('LOWER(b.district) LIKE LOWER(@district)'); params.district = `%${district}%`; }
  if (search) {
    clauses.push('(LOWER(b.name) LIKE LOWER(@search) OR LOWER(b.address) LIKE LOWER(@search) OR LOWER(b.description) LIKE LOWER(@search))');
    params.search = `%${search}%`;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  let rows = db.prepare(`${baseBusinessQuery} ${where} GROUP BY b.id ORDER BY b.rating DESC`).all(params);
  let result = rows.map(normalizeBusiness);

  if (lat && lng) {
    result = result
      .map((business) => ({
        ...business,
        distance: calcDistanceKm(Number(lat), Number(lng), business.location.coordinates[1], business.location.coordinates[0]),
      }))
      .filter((business) => business.distance <= Number(radius))
      .sort((a, b) => a.distance - b.distance);
  }

  res.json(result);
};

const getMyBusinesses = async (req, res) => {
  const rows = db.prepare(`${baseBusinessQuery} WHERE b.owner_id = @ownerId GROUP BY b.id ORDER BY b.created_at DESC`).all({ ownerId: req.user._id });
  const services = db.prepare('SELECT * FROM services WHERE business_id = ? ORDER BY created_at DESC');
  const result = rows.map((row) => {
    const business = normalizeBusiness(row);
    business.services = services.all(business._id).map(normalizeService);
    return business;
  });
  res.json(result);
};

const getBusinessById = async (req, res) => {
  const row = db.prepare(`${baseBusinessQuery} WHERE b.id = @id GROUP BY b.id`).get({ id: req.params.id });
  const business = normalizeBusiness(row);
  if (!business) return res.status(404).json({ message: 'Business not found' });

  // Increment view count (fire-and-forget)
  db.prepare('UPDATE businesses SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);

  const services = db.prepare('SELECT * FROM services WHERE business_id = ? AND is_active = 1 ORDER BY price ASC').all(business._id).map(normalizeService);
  const reviews = db.prepare(`
    SELECT r.id AS _id, r.rating, r.comment, r.created_at AS createdAt, u.id AS user_id, u.name AS user_name, u.avatar AS user_avatar
    FROM reviews r
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.business_id = ?
    ORDER BY r.created_at DESC
  `).all(business._id).map((review) => ({
    _id: review._id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    user: { _id: review.user_id, name: review.user_name, avatar: review.user_avatar },
  }));

  res.json({ business, services, reviews });
};

const createBusiness = async (req, res) => {
  const {
    name, description = '', category, subcategory = '', city = 'Tashkent', district = '',
    address, coordinates, photos = [], amenities = [], workingHours, contacts = {},
    vrTourUrl = '', vrPreviewImage = '', businessType = 'service',
  } = req.body;

  if (!name || !address || !coordinates || !category) {
    return res.status(400).json({ message: 'Name, address, category and coordinates are required' });
  }

  const businessId = randomUUID();
  db.prepare(`
    INSERT INTO businesses (
      id, owner_id, name, description, category, subcategory, city, district, address,
      lat, lng, photos, amenities, working_hours, contacts, status, vr_tour_url, vr_preview_image, business_type
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)
  `).run(
    businessId, req.user._id, name, description, category, subcategory, city, district, address,
    Number(coordinates[1]), Number(coordinates[0]), JSON.stringify(photos), JSON.stringify(amenities),
    JSON.stringify(workingHours || {}), JSON.stringify(contacts), vrTourUrl, vrPreviewImage, businessType
  );

  const business = normalizeBusiness(db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId));
  res.status(201).json(business);
};

const updateBusiness = async (req, res) => {
  const row = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Business not found' });
  if (row.owner_id !== req.user._id && req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });

  const current = normalizeBusiness(row);
  const next = {
    name: req.body.name ?? current.name,
    description: req.body.description ?? current.description,
    category: req.body.category ?? current.category,
    subcategory: req.body.subcategory ?? current.subcategory,
    city: req.body.city ?? current.city,
    district: req.body.district ?? current.district,
    address: req.body.address ?? current.address,
    lat: req.body.coordinates ? Number(req.body.coordinates[1]) : current.location.coordinates[1],
    lng: req.body.coordinates ? Number(req.body.coordinates[0]) : current.location.coordinates[0],
    photos: JSON.stringify(req.body.photos ?? current.photos),
    amenities: JSON.stringify(req.body.amenities ?? current.amenities),
    workingHours: JSON.stringify(req.body.workingHours ?? current.workingHours),
    contacts: JSON.stringify(req.body.contacts ?? current.contacts),
    vrTourUrl: req.body.vrTourUrl ?? current.vrTourUrl,
    vrPreviewImage: req.body.vrPreviewImage ?? current.vrPreviewImage,
    businessType: req.body.businessType ?? current.businessType,
    id: req.params.id,
  };

  db.prepare(`
    UPDATE businesses SET
      name = @name, description = @description, category = @category, subcategory = @subcategory,
      city = @city, district = @district, address = @address, lat = @lat, lng = @lng,
      photos = @photos, amenities = @amenities, working_hours = @workingHours, contacts = @contacts,
      vr_tour_url = @vrTourUrl, vr_preview_image = @vrPreviewImage, business_type = @businessType
    WHERE id = @id
  `).run(next);

  const updated = normalizeBusiness(db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id));
  res.json(updated);
};

const deleteBusiness = async (req, res) => {
  const row = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Business not found' });
  if (row.owner_id !== req.user._id && req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });

  db.prepare('DELETE FROM businesses WHERE id = ?').run(req.params.id);
  res.json({ message: 'Business deleted' });
};

module.exports = { getBusinesses, getMyBusinesses, getBusinessById, createBusiness, updateBusiness, deleteBusiness };
