const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io'); // 1. Socket.io import kiya
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

connectDB().then(() => seedCategories());

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 2. HTTP Server banayein
const server = http.createServer(app);

// 3. Socket.io Initialize karein
const io = new Server(server, {
  cors: {
    origin: "*", // Sab origins (Flutter / Web / Postman) ko allow karne ke liye
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// 4. 'io' instance ko app mein save karein taake controllers mein `req.app.get('io')` se mil sake
app.set('io', io);

// 5. Socket Connection Logic
io.on('connection', (socket) => {
  console.log('⚡ User Connect Hua, Socket ID:', socket.id);

  // Jab Flutter App open ho, wo user ki ID ka Private Room join karegi
  socket.on('join_room', (userId) => {
    socket.join(userId);
    console.log(`📌 User ${userId} apne private room mein add ho gaya.`);
  });

  socket.on('disconnect', () => {
    console.log('❌ User Disconnect Hua:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Local Services API is running' });
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
