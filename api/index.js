const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('../src/config/db');
const { notFound, errorHandler } = require('../src/middleware/errorMiddleware');

dotenv.config();

// Initialize Firebase safely for Vercel
try {
  const admin = require('firebase-admin');
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin SDK initialized from ENV');
    }
  }
} catch (error) {
  console.log('⚠️ Firebase initialization skipped:', error.message);
}

const authRoutes = require('../src/routes/authRoutes');
const serviceRoutes = require('../src/routes/serviceRoutes');
const bookingRoutes = require('../src/routes/bookingRoutes');
const categoryRoutes = require('../src/routes/categoryRoutes');
const reviewRoutes = require('../src/routes/reviewRoutes');
const notificationRoutes = require('../src/routes/notificationRoutes');
const chatRoutes = require('../src/routes/chatRoutes');
const locationRoutes = require('../src/routes/locationRoutes');
const availabilityRoutes = require('../src/routes/availabilityRoutes');
const invoiceRoutes = require('../src/routes/invoiceRoutes');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.options('*', cors());

app.use(express.json());

// Mock IO for Vercel Serverless environment
app.set('io', {
  to: () => ({ emit: () => {} }),
  emit: () => {}
});

let categoriesSeeded = false;

app.use(async (req, res, next) => {
  try {
    await connectDB();
    if (!categoriesSeeded) {
      const seedCategories = require('../src/utils/seedCategories');
      await seedCategories();
      categoriesSeeded = true;
    }
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

app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/invoices', invoiceRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;