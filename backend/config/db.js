const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = process.env.SQLITE_PATH || path.join(dataDir, 'hizmat-top.sqlite');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

const json = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeBusiness = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    owner: row.owner_name ? { _id: row.owner_id, name: row.owner_name, email: row.owner_email } : row.owner_id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description || '',
    category: row.category,
    subcategory: row.subcategory || '',
    city: row.city || '',
    district: row.district || '',
    address: row.address || '',
    location: { type: 'Point', coordinates: [Number(row.lng), Number(row.lat)] },
    photos: json(row.photos, []),
    amenities: json(row.amenities, []),
    workingHours: json(row.working_hours, {}),
    contacts: json(row.contacts, { phone: '', telegram: '', instagram: '' }),
    rating: Number(row.rating || 0),
    reviewCount: Number(row.review_count || 0),
    verified: row.status === 'approved',
    status: row.status,
    rejectionReason: row.rejection_reason || '',
    blockedReason: row.blocked_reason || '',
    vrTourUrl: row.vr_tour_url || '',
    vrPreviewImage: row.vr_preview_image || '',
    businessType: row.business_type || 'service',
    createdAt: row.created_at,
    viewCount: Number(row.view_count || 0),
    minPrice: row.min_price === null || row.min_price === undefined ? 0 : Number(row.min_price),
  };
};

const normalizeService = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    business: row.business_id,
    name: row.name,
    description: row.description || '',
    price: Number(row.price || 0),
    durationMinutes: Number(row.duration_minutes || 60),
    currency: row.currency || "so'm",
    isActive: Boolean(row.is_active),
    isFlashDeal: Boolean(row.is_flash_deal),
    discountPrice: row.discount_price === null || row.discount_price === undefined ? null : Number(row.discount_price),
    flashDealEndsAt: row.flash_deal_ends_at || null,
    photo: row.photo || '',
  };
};

const normalizeUser = (row, includePassword = false) => {
  if (!row) return null;
  const user = {
    _id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    role: row.role,
    avatar: row.avatar || '',
    isBlocked: Boolean(row.is_blocked),
    blockedReason: row.blocked_reason || '',
    createdAt: row.created_at,
    favorites: row.favorites ? json(row.favorites, []) : [],
  };
  if (includePassword) user.password = row.password;
  return user;
};

const normalizeVrTour = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    businessId: row.business_id,
    ownerId: row.owner_id,
    originalVideoUrl: row.original_video_url || '',
    originalVideoPath: row.original_video_path || '',
    status: row.status,
    resultType: row.result_type || 'placeholder',
    resultUrl: row.result_url || '',
    previewImageUrl: row.preview_image_url || '',
    processingProgress: Number(row.processing_progress || 0),
    processingError: row.processing_error || '',
    isPublished: Boolean(row.is_published),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const normalizeBusinessVirtualTour = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    businessId: row.business_id,
    title: row.title || '',
    description: row.description || '',
    mediaType: row.media_type || 'video',
    media_type: row.media_type || 'video',
    fileUrl: row.file_url || '',
    file_url: row.file_url || '',
    previewImageUrl: row.preview_image_url || '',
    preview_image_url: row.preview_image_url || '',
    durationSeconds: row.duration_seconds === null || row.duration_seconds === undefined ? null : Number(row.duration_seconds),
    duration_seconds: row.duration_seconds === null || row.duration_seconds === undefined ? null : Number(row.duration_seconds),
    status: row.status || 'processing',
    sortOrder: Number(row.sort_order || 0),
    sort_order: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const initDb = () => {
  // Add new columns to existing tables safely
  try { db.exec(`ALTER TABLE businesses ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS promoted_deals (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL,
    title TEXT DEFAULT '',
    banner_image TEXT DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
  )`); } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      phone TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'owner', 'admin')),
      avatar TEXT DEFAULT '',
      is_blocked INTEGER NOT NULL DEFAULT 0,
      blocked_reason TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_ru TEXT NOT NULL,
      name_uz TEXT NOT NULL,
      icon TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT NOT NULL,
      subcategory TEXT DEFAULT '',
      city TEXT DEFAULT 'Tashkent',
      district TEXT DEFAULT '',
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      photos TEXT DEFAULT '[]',
      amenities TEXT DEFAULT '[]',
      working_hours TEXT DEFAULT '{}',
      contacts TEXT DEFAULT '{}',
      rating REAL NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'blocked')),
      rejection_reason TEXT DEFAULT '',
      blocked_reason TEXT DEFAULT '',
      vr_tour_url TEXT DEFAULT '',
      vr_preview_image TEXT DEFAULT '',
      business_type TEXT NOT NULL DEFAULT 'service' CHECK(business_type IN ('service', 'supplier', 'both')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Flash deals promoted by admin (separate from service-level flash deals)
    CREATE TABLE IF NOT EXISTS promoted_deals (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      title TEXT DEFAULT '',
      banner_image TEXT DEFAULT '',
      priority INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      currency TEXT NOT NULL DEFAULT 'so''m',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_flash_deal INTEGER NOT NULL DEFAULT 0,
      discount_price REAL,
      flash_deal_ends_at TEXT,
      photo TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      business_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      total_price REAL NOT NULL DEFAULT 0,
      original_price REAL,
      final_price REAL,
      was_flash_deal INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')),
      status_reason TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      business_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, business_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL,
      business_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, business_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(business_id, user_id),
      FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vr_tours (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      original_video_url TEXT NOT NULL,
      original_video_path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'uploaded' CHECK(status IN ('uploaded', 'queued', 'processing', 'ready', 'failed', 'published', 'archived')),
      result_type TEXT NOT NULL DEFAULT 'placeholder' CHECK(result_type IN ('gaussian_splatting', 'nerf', 'panorama', 'external_url', 'placeholder')),
      result_url TEXT DEFAULT '',
      preview_image_url TEXT DEFAULT '',
      processing_progress INTEGER NOT NULL DEFAULT 0,
      processing_error TEXT DEFAULT '',
      is_published INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS business_virtual_tours (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      media_type TEXT NOT NULL DEFAULT 'video' CHECK(media_type IN ('video', 'panorama', 'video360')),
      file_url TEXT NOT NULL,
      file_path TEXT DEFAULT '',
      preview_image_url TEXT DEFAULT '',
      preview_image_path TEXT DEFAULT '',
      duration_seconds INTEGER,
      status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'active', 'inactive', 'failed')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    -- Migrate: add view_count column if it doesn't exist yet (safe on existing DBs)
    -- SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we use a workaround via trigger-free approach:
    -- We just catch the error in JS after exec.

    CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
    CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category);
    CREATE INDEX IF NOT EXISTS idx_services_business ON services(business_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_service_date ON bookings(service_id, date);
    CREATE INDEX IF NOT EXISTS idx_bookings_business ON bookings(business_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_owner ON conversations(owner_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_vr_tours_business ON vr_tours(business_id, status, is_published);
    CREATE INDEX IF NOT EXISTS idx_business_virtual_tours_business ON business_virtual_tours(business_id, status, sort_order);
  `);
};

module.exports = {
  db,
  dbPath,
  initDb,
  json,
  normalizeBusiness,
  normalizeService,
  normalizeUser,
  normalizeVrTour,
  normalizeBusinessVirtualTour,
};
