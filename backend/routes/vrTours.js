const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { db, normalizeVrTour } = require('../config/db');
const { protect, owner } = require('../middleware/auth');

const router = express.Router();
const uploadRoot = path.join(__dirname, '..', 'uploads', 'vr-videos');
const maxVideoSizeMb = Number(process.env.VR_VIDEO_MAX_MB || 250);

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const getBusiness = (businessId) => db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);

const canManageBusiness = (user, business) => (
  user && business && (user.role === 'admin' || business.owner_id === user._id)
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const target = path.join(uploadRoot, req.params.businessId || 'general');
    ensureDir(target);
    cb(null, target);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.mp4';
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: maxVideoSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('video/')) {
      return cb(new Error('Only video files are allowed'));
    }
    return cb(null, true);
  },
});

const getTourById = (id) => db.prepare('SELECT * FROM vr_tours WHERE id = ?').get(id);

const updateTourStatus = (id, status, progress, extra = {}) => {
  const current = getTourById(id);
  if (!current || ['published', 'archived', 'failed'].includes(current.status)) return;

  db.prepare(`
    UPDATE vr_tours
    SET status = ?,
        processing_progress = ?,
        result_type = COALESCE(?, result_type),
        result_url = COALESCE(?, result_url),
        preview_image_url = COALESCE(?, preview_image_url),
        processing_error = COALESCE(?, processing_error),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    status,
    progress,
    extra.resultType ?? null,
    extra.resultUrl ?? null,
    extra.previewImageUrl ?? null,
    extra.processingError ?? null,
    id,
  );
};

const enqueueMockProcessing = (tourId) => {
  setTimeout(() => updateTourStatus(tourId, 'queued', 10), 500);
  setTimeout(() => updateTourStatus(tourId, 'processing', 35), 2000);
  setTimeout(() => updateTourStatus(tourId, 'processing', 70), 4500);
  setTimeout(() => {
    updateTourStatus(tourId, 'ready', 100, {
      resultType: 'placeholder',
      resultUrl: `/vr-tour/${tourId}`,
      previewImageUrl: '',
    });
  }, 7000);
};

router.get('/business/:businessId', protect, owner, (req, res) => {
  const business = getBusiness(req.params.businessId);
  if (!business) return res.status(404).json({ message: 'Business not found' });
  if (!canManageBusiness(req.user, business)) return res.status(403).json({ message: 'Not allowed to manage this business' });

  const rows = db.prepare('SELECT * FROM vr_tours WHERE business_id = ? ORDER BY created_at DESC').all(req.params.businessId);
  res.json(rows.map(normalizeVrTour));
});

router.get('/public/business/:businessId', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM vr_tours
    WHERE business_id = ?
      AND (is_published = 1 OR status IN ('queued', 'processing', 'ready'))
    ORDER BY is_published DESC, created_at DESC
    LIMIT 1
  `).all(req.params.businessId);
  res.json(rows.length ? normalizeVrTour(rows[0]) : null);
});

router.get('/:id', (req, res) => {
  const tour = normalizeVrTour(getTourById(req.params.id));
  if (!tour) return res.status(404).json({ message: 'VR tour not found' });
  res.json(tour);
});

router.post('/business/:businessId/upload', protect, owner, upload.single('video'), (req, res) => {
  const business = getBusiness(req.params.businessId);
  if (!business) return res.status(404).json({ message: 'Business not found' });
  if (!canManageBusiness(req.user, business)) return res.status(403).json({ message: 'Not allowed to manage this business' });
  if (!req.file) return res.status(400).json({ message: 'Video file is required' });

  const id = crypto.randomUUID();
  const publicUrl = `/uploads/vr-videos/${req.params.businessId}/${req.file.filename}`;

  db.prepare(`
    INSERT INTO vr_tours (
      id, business_id, owner_id, original_video_url, original_video_path,
      status, result_type, processing_progress
    )
    VALUES (?, ?, ?, ?, ?, 'uploaded', 'placeholder', 0)
  `).run(id, business.id, business.owner_id, publicUrl, req.file.path);

  enqueueMockProcessing(id);
  res.status(201).json(normalizeVrTour(getTourById(id)));
});

router.patch('/:id/publish', protect, owner, (req, res) => {
  const row = getTourById(req.params.id);
  const tour = normalizeVrTour(row);
  if (!tour) return res.status(404).json({ message: 'VR tour not found' });

  const business = getBusiness(tour.businessId);
  if (!canManageBusiness(req.user, business)) return res.status(403).json({ message: 'Not allowed to manage this tour' });
  if (tour.status !== 'ready' && tour.status !== 'published') {
    return res.status(400).json({ message: 'Only ready tours can be published' });
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE vr_tours
      SET status = 'archived', is_published = 0, updated_at = CURRENT_TIMESTAMP
      WHERE business_id = ? AND id <> ? AND is_published = 1
    `).run(tour.businessId, tour._id);
    db.prepare(`
      UPDATE vr_tours
      SET status = 'published', is_published = 1, processing_progress = 100, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(tour._id);
  });

  transaction();
  res.json(normalizeVrTour(getTourById(tour._id)));
});

router.patch('/:id/archive', protect, owner, (req, res) => {
  const tour = normalizeVrTour(getTourById(req.params.id));
  if (!tour) return res.status(404).json({ message: 'VR tour not found' });

  const business = getBusiness(tour.businessId);
  if (!canManageBusiness(req.user, business)) return res.status(403).json({ message: 'Not allowed to manage this tour' });

  db.prepare(`
    UPDATE vr_tours
    SET status = 'archived', is_published = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(tour._id);

  res.json(normalizeVrTour(getTourById(tour._id)));
});

router.delete('/:id', protect, owner, (req, res) => {
  const tour = normalizeVrTour(getTourById(req.params.id));
  if (!tour) return res.status(404).json({ message: 'VR tour not found' });

  const business = getBusiness(tour.businessId);
  if (!canManageBusiness(req.user, business)) return res.status(403).json({ message: 'Not allowed to manage this tour' });

  db.prepare('DELETE FROM vr_tours WHERE id = ?').run(tour._id);
  if (tour.originalVideoPath && fs.existsSync(tour.originalVideoPath)) {
    fs.unlink(tour.originalVideoPath, () => {});
  }
  res.json({ message: 'VR tour deleted' });
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: `Video must be ${maxVideoSizeMb}MB or smaller` });
  }
  if (err.message === 'Only video files are allowed') {
    return res.status(400).json({ message: err.message });
  }
  return next(err);
});

module.exports = router;
