const express = require('express');
const { createService, updateService, deleteService, getFlashDeals } = require('../controllers/serviceController');
const { protect, owner } = require('../middleware/auth');

const router = express.Router();

// Public
router.get('/flash-deals', getFlashDeals);

// Owner
router.post('/', protect, owner, createService);
router.put('/:id', protect, owner, updateService);
router.delete('/:id', protect, owner, deleteService);

module.exports = router;
