const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all origins & preflight
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// Ensure DB is connected per request on Vercel
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Socket.io Setup
if (!process.env.VERCEL) {
  const server = http.createServer(app);
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
  });
  app.set('io', io);

  io.on('connection', (socket) => {
    socket.on('join_room', (userId) => socket.join(userId));
  });

  if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
} else {
  // Safe mock IO for Vercel Serverless environment
  app.set('io', {
    to: () => ({ emit: () => {} }),
    emit: () => {}
  });
}

app.get('/', (req, res) => {
  res.json({ message: 'Local Services API is running on Vercel' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
