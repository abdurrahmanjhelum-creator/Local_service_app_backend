const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const seedCategories = require('./utils/seedCategories');
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

app.use(cors());
app.use(express.json());

// Middleware to ensure DB is connected on Vercel Serverless Function Invocation
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Seed categories on initial startup
connectDB().then(() => seedCategories()).catch(() => {});

// HTTP & Socket.io Server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('⚡ User Connect Hua, Socket ID:', socket.id);

  socket.on('join_room', (userId) => {
    socket.join(userId);
    console.log(`📌 User ${userId} apne private room mein add ho gaya.`);
  });

  socket.on('disconnect', () => {
    console.log('❌ User Disconnect Hua:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Local Services API is running on Vercel' });
});

// Serve local uploads
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
