const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const { initDb, dbPath } = require('./config/db');

dotenv.config();
initDb();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/businesses', require('./routes/businesses'));
app.use('/api/business', require('./routes/businessVirtualTours'));
app.use('/api/services', require('./routes/services'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/ai-chat', require('./routes/aiChat'));
app.use('/api/ai-insights', require('./routes/aiInsights'));
app.use('/api/vr-tours', require('./routes/vrTours'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'HizmatTop',
    database: dbPath,
    timestamp: new Date().toISOString(),
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`HizmatTop API running on port ${PORT}`));
