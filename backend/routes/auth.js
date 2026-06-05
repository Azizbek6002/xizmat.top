const express = require('express');
const { register, login, getProfile, toggleFavorite, getFavorites } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', protect, getProfile);
router.post('/favorites/:id', protect, toggleFavorite);
router.get('/favorites', protect, getFavorites);

module.exports = router;