/**
 * HizmatTop API client for Telegram bot
 * All calls go through the existing backend REST API
 */

const axios = require('axios');

const BASE = process.env.API_URL || 'http://localhost:5000/api';

// per-user JWT token store  { telegramId → token }
const tokenStore = {};

const client = (telegramId) => {
  const token = tokenStore[telegramId];
  return axios.create({
    baseURL: BASE,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeout: 10000,
  });
};

// ── auth ──────────────────────────────────────────────────────────────────────
const login = async (telegramId, email, password) => {
  const res = await client(telegramId).post('/auth/login', { email, password });
  tokenStore[telegramId] = res.data.token;
  return res.data;
};

const getProfile = async (telegramId) => {
  const res = await client(telegramId).get('/auth/profile');
  return res.data;
};

const isLoggedIn = (telegramId) => Boolean(tokenStore[telegramId]);

const logout = (telegramId) => { delete tokenStore[telegramId]; };

// ── AI chat (re-uses the smart booking wizard) ────────────────────────────────
const aiChat = async (telegramId, message, language = 'uz') => {
  const res = await client(telegramId).post('/ai-chat', { message, language });
  return res.data;
};

const aiReset = async (telegramId, language = 'uz') => {
  try { await client(telegramId).post('/ai-chat/reset', { language }); } catch {}
};

// ── businesses ────────────────────────────────────────────────────────────────
const searchBusinesses = async (telegramId, { category, search } = {}) => {
  const params = {};
  if (category) params.category = category;
  if (search)   params.search   = search;
  const res = await client(telegramId).get('/businesses', { params });
  return res.data;
};

const getBusiness = async (telegramId, businessId) => {
  const res = await client(telegramId).get(`/businesses/${businessId}`);
  return res.data;
};

// ── slots ─────────────────────────────────────────────────────────────────────
const getSlots = async (telegramId, serviceId, date) => {
  const res = await client(telegramId).get(`/bookings/slots/${serviceId}`, { params: { date } });
  return res.data;
};

// ── bookings ──────────────────────────────────────────────────────────────────
const createBooking = async (telegramId, payload) => {
  const res = await client(telegramId).post('/bookings', payload);
  return res.data;
};

const getMyBookings = async (telegramId) => {
  const res = await client(telegramId).get('/bookings/my');
  return res.data;
};

const cancelBooking = async (telegramId, bookingId) => {
  const res = await client(telegramId).patch(`/bookings/${bookingId}/cancel`);
  return res.data;
};

// ── notifications ─────────────────────────────────────────────────────────────
const getNotifications = async (telegramId) => {
  const res = await client(telegramId).get('/notifications');
  return res.data;
};

module.exports = {
  login, getProfile, isLoggedIn, logout,
  aiChat, aiReset,
  searchBusinesses, getBusiness,
  getSlots, createBooking, getMyBookings, cancelBooking,
  getNotifications,
};
