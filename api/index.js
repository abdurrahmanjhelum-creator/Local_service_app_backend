const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('../src/config/db');
const { notFound, errorHandler } = require('../src/middleware/errorMiddleware');

dotenv.config();

const authRoutes = require('../src/routes/authRoutes');
const serviceRoutes = require('../src/routes/serviceRoutes');
const bookingRoutes = require('../src/routes/bookingRoutes');
const categoryRoutes = require('../src/routes/categoryRoutes');
const reviewRoutes = require('../src/routes/reviewRoutes');
const notificationRoutes = require('../src/routes/notificationRoutes');
const chatRoutes = require('../src/routes/chatRoutes');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// Mock IO for Vercel Serverless environment
app.set('io', {
  to: () => ({ emit: () => {} }),
  emit: () => {}
});

app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (e) {
    console.error('DB connect error:', e);
  }
  next();
});

app.get('/', (req, res) => {
  res.json({ message: 'Local Services API is running on Vercel' });
});

app.get('/api', (req, res) => {
  res.json({ message: 'Local Services API is running on Vercel' });
});

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
