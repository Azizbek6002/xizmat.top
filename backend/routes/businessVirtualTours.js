const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const multer = require('multer');
const { db, normalizeBusinessVirtualTour } = require('../config/db');
const { protect, owner } = require('../middleware/auth');

const router = express.Router();
const uploadRoot = path.join(__dirname, '..', 'uploads', 'virtual-tours');
const maxVideoSizeMb = Number(process.env.VIRTUAL_TOUR_MAX_MB || 200);
const allowedVideoExts = new Set(['.mp4', '.mov', '.webm']);
const allowedPreviewExts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const allowedVideoMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'application/octet-stream']);
const allowedPreviewMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const publicUrlFor = (businessId, filename) => `/uploads/virtual-tours/${businessId}/${filename}`;
const getBusiness = (businessId) => db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
const getTour = (businessId, tourId) => db.prepare('SELECT * FROM business_virtual_tours WHERE business_id = ? AND id = ?').get(businessId, tourId);

const canManageBusiness = (user, business) => (
  user && business && (user.role === 'admin' || business.owner_id === user._id)
);

const runTool = (command, args) => new Promise((resolve) => {
  execFile(command, args, { windowsHide: true }, (error, stdout) => {
    if (error) return resolve(null);
    resolve(stdout.trim());
  });
});

const readDurationSeconds = async (filePath) => {
  const output = await runTool('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const value = Number(output);
  return Number.isFinite(value) ? Math.round(value) : null;
};

const createPreview = async (videoPath, previewPath) => {
  const output = await runTool('ffmpeg', [
    '-y',
    '-ss', '00:00:03',
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', '2',
    previewPath,
  ]);
  return output !== null && fs.existsSync(previewPath);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const target = path.join(uploadRoot, req.params.businessId);
    ensureDir(target);
    cb(null, target);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: maxVideoSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (file.fieldname === 'video_file' || file.fieldname === 'video') {
      if (!allowedVideoExts.has(ext)) return cb(new Error('Only mp4, mov or webm videos are allowed'));
      if (file.mimetype && !allowedVideoMimeTypes.has(file.mimetype) && !file.mimetype.startsWith('video/')) {
        return cb(new Error('Only mp4, mov or webm videos are allowed'));
      }
      return cb(null, true);
    }
    if (file.fieldname === 'preview_image') {
      if (!allowedPreviewExts.has(ext)) return cb(new Error('Only jpg, png or webp preview images are allowed'));
      if (!allowedPreviewMimeTypes.has(file.mimetype)) return cb(new Error('Only jpg, png or webp preview images are allowed'));
      return cb(null, true);
    }
    return cb(new Error('Unexpected upload field'));
  },
});

const uploadFields = upload.fields([
  { name: 'video_file', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'preview_image', maxCount: 1 },
]);

router.get('/:businessId/virtual-tours', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM business_virtual_tours
    WHERE business_id = ? AND status = 'active'
    ORDER BY sort_order ASC, created_at ASC
  `).all(req.params.businessId);
  res.json(rows.map(normalizeBusinessVirtualTour));
});

router.get('/:businessId/virtual-tours/manage', protect, owner, (req, res) => {
  const business = getBusiness(req.params.businessId);
  if (!business) return res.status(404).json({ message: 'Business not found' });
  if (!canManageBusiness(req.user, business)) return res.status(403).json({ message: 'Not allowed to manage this business' });

  const rows = db.prepare(`
    SELECT * FROM business_virtual_tours
    WHERE business_id = ?
    ORDER BY sort_order ASC, created_at DESC
  `).all(req.params.businessId);
  res.json(rows.map(normalizeBusinessVirtualTour));
});

router.post('/:businessId/virtual-tours', protect, owner, uploadFields, async (req, res, next) => {
  try {
    const business = getBusiness(req.params.businessId);
    if (!business) return res.status(404).json({ message: 'Business not found' });
    if (!canManageBusiness(req.user, business)) return res.status(403).json({ message: 'Not allowed to manage this business' });

    const videoFile = req.files?.video_file?.[0] || req.files?.video?.[0];
    const previewFile = req.files?.preview_image?.[0];
    if (!videoFile) return res.status(400).json({ message: 'video_file is required' });

    const id = crypto.randomUUID();
    const requestedStatus = ['active', 'inactive'].includes(req.body.status) ? req.body.status : 'active';
    const fileUrl = publicUrlFor(req.params.businessId, videoFile.filename);
    const manualPreviewUrl = previewFile ? publicUrlFor(req.params.businessId, previewFile.filename) : '';
    const manualPreviewPath = previewFile ? previewFile.path : '';

    db.prepare(`
      INSERT INTO business_virtual_tours (
        id, business_id, title, description, media_type, file_url, file_path,
        preview_image_url, preview_image_path, status, sort_order
      )
      VALUES (?, ?, ?, ?, 'video', ?, ?, ?, ?, 'processing', ?)
    `).run(
      id,
      business.id,
      req.body.title || 'Xona videosi',
      req.body.description || '',
      fileUrl,
      videoFile.path,
      manualPreviewUrl,
      manualPreviewPath,
      Number(req.body.sort_order || 0),
    );

    let status = requestedStatus;
    let durationSeconds = await readDurationSeconds(videoFile.path);
    let previewImageUrl = manualPreviewUrl;
    let previewImagePath = manualPreviewPath;

    if (durationSeconds !== null && durationSeconds > 60) {
      status = 'failed';
    }

    if (status !== 'failed' && !previewImageUrl) {
      const previewFilename = `${path.parse(videoFile.filename).name}-preview.jpg`;
      const generatedPreviewPath = path.join(uploadRoot, req.params.businessId, previewFilename);
      const generated = await createPreview(videoFile.path, generatedPreviewPath);
      if (generated) {
        previewImageUrl = publicUrlFor(req.params.businessId, previewFilename);
        previewImagePath = generatedPreviewPath;
      }
    }

    db.prepare(`
      UPDATE business_virtual_tours
      SET duration_seconds = ?,
          preview_image_url = ?,
          preview_image_path = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(durationSeconds, previewImageUrl, previewImagePath, status, id);

    const tour = normalizeBusinessVirtualTour(getTour(req.params.businessId, id));
    if (status === 'failed') {
      return res.status(400).json({ message: 'Video duration must be 60 seconds or less', tour });
    }
    return res.status(201).json(tour);
  } catch (err) {
    return next(err);
  }
});

router.patch('/:businessId/virtual-tours/:tourId', protect, owner, (req, res) => {
  const business = getBusiness(req.params.businessId);
  if (!business) return res.status(404).json({ message: 'Business not found' });
  if (!canManageBusiness(req.user, business)) return res.status(403).json({ message: 'Not allowed to manage this business' });

  const row = getTour(req.params.businessId, req.params.tourId);
  if (!row) return res.status(404).json({ message: 'Virtual tour not found' });

  const next = {
    title: req.body.title ?? row.title,
    description: req.body.description ?? row.description,
    status: ['active', 'inactive', 'processing', 'failed'].includes(req.body.status) ? req.body.status : row.status,
    sortOrder: req.body.sort_order ?? req.body.sortOrder ?? row.sort_order,
  };

  db.prepare(`
    UPDATE business_virtual_tours
    SET title = @title,
        description = @description,
        status = @status,
        sort_order = @sortOrder,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id AND business_id = @businessId
  `).run({ ...next, id: req.params.tourId, businessId: req.params.businessId });

  res.json(normalizeBusinessVirtualTour(getTour(req.params.businessId, req.params.tourId)));
});

router.delete('/:businessId/virtual-tours/:tourId', protect, owner, (req, res) => {
  const business = getBusiness(req.params.businessId);
  if (!business) return res.status(404).json({ message: 'Business not found' });
  if (!canManageBusiness(req.user, business)) return res.status(403).json({ message: 'Not allowed to manage this business' });

  const row = getTour(req.params.businessId, req.params.tourId);
  if (!row) return res.status(404).json({ message: 'Virtual tour not found' });

  db.prepare('DELETE FROM business_virtual_tours WHERE id = ? AND business_id = ?').run(req.params.tourId, req.params.businessId);
  [row.file_path, row.preview_image_path].filter(Boolean).forEach((target) => {
    if (fs.existsSync(target)) fs.unlink(target, () => {});
  });
  res.json({ message: 'Virtual tour deleted' });
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: `Video must be ${maxVideoSizeMb}MB or smaller` });
  }
  if (err.message && (err.message.includes('allowed') || err.message.includes('Unexpected'))) {
    return res.status(400).json({ message: err.message });
  }
  return next(err);
});

module.exports = router;
