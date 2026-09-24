const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');

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
  const jwt = require('jsonwebtoken');
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
  });
  app.set('io', io);

  // JWT Authentication Middleware for Socket.io
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        
        // Fetch user details for chat
        try {
          const UserModel = require('./models/User');
          const user = await UserModel.findById(decoded.id);
          if (user) {
            socket.userName = user.name;
            socket.userProfileImage = user.profileImage || '';
          }
        } catch (err) {
          console.warn('⚠️ Error fetching user details for socket:', err.message);
        }
      } catch (err) {
        console.warn('🔒 Socket JWT verification warning:', err.message);
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`🔗 Socket connected: ${socket.id}`);
    
    // Auto-join authenticated user room
    if (socket.userId) {
      socket.join(socket.userId.toString());
      console.log(`👤 User ${socket.userId} auto-joined their room`);
    }
    
    socket.on('join_room', (userId) => {
      if (userId) {
        // Security: Only join room if matches token user ID or fallback
        if (!socket.userId || socket.userId.toString() === userId.toString()) {
          socket.join(userId.toString());
          console.log(`📌 Socket joined room: ${userId.toString()}`);
        }
      }
    });

    // Chat-specific socket events
    
    // Join conversation room
    socket.on('join_conversation', async (conversationId) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        if (conversation && conversation.isParticipant(socket.userId)) {
          socket.join(conversationId.toString());
          console.log(`💬 Socket joined conversation room: ${conversationId}`);
          
          // Send typing indicator cleared event
          socket.to(conversationId.toString()).emit('typing_indicator', {
            conversationId,
            userId: socket.userId,
            userName: socket.userName || 'User',
            isTyping: false
          });
        } else {
          console.warn(`⚠️ Unauthorized attempt to join conversation: ${conversationId}`);
        }
      } catch (error) {
        console.error('Error joining conversation:', error);
      }
    });

    // Leave conversation room
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(conversationId.toString());
      console.log(`💬 Socket left conversation room: ${conversationId}`);
      
      // Clear typing indicator when leaving
      socket.to(conversationId.toString()).emit('typing_indicator', {
        conversationId,
        userId: socket.userId,
        userName: socket.userName || 'User',
        isTyping: false
      });
    });

    // Send message via socket
    socket.on('send_message', async (messageData) => {
      try {
        const {
          conversationId,
          senderId,
          senderName,
          senderProfileImage,
          content,
          type = 'text'
        } = messageData;

        // Verify user is authenticated and matches sender
        if (!socket.userId || socket.userId.toString() !== senderId.toString()) {
          console.warn('⚠️ Unauthorized message send attempt');
          return;
        }

        // Verify conversation exists and user is participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.isParticipant(senderId)) {
          console.warn('⚠️ Invalid conversation or unauthorized user');
          return;
        }

        // Create message
        const message = await Message.create({
          conversationId,
          senderId,
          senderName,
          senderProfileImage: senderProfileImage || '',
          content,
          type,
          status: 'sent'
        });

        // Update conversation last message
        conversation.lastMessage = content;
        conversation.lastMessageTime = message.createdAt;
        
        // Increment unread count for recipient
        const recipientId = conversation.customerId.toString() === senderId.toString() 
          ? conversation.providerId 
          : conversation.customerId;
        
        conversation.unreadCount = await Message.countDocuments({
          conversationId,
          senderId: { $ne: recipientId },
          isRead: false
        });

        await conversation.save();

        // Emit message to conversation room
        io.to(conversationId.toString()).emit('chat_message', message);
        
        // Emit conversation update to both participants
        io.to(conversation.customerId.toString()).emit('conversation_updated', conversation);
        io.to(conversation.providerId.toString()).emit('conversation_updated', conversation);
        
        // Emit message sent confirmation
        socket.emit('message_sent', message);
        
        console.log(`💬 Message sent in conversation ${conversationId} by user ${senderId}`);
      } catch (error) {
        console.error('Error sending message via socket:', error);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing_indicator', async (data) => {
      try {
        const { conversationId, userId, userName, isTyping } = data;

        // Verify user is authenticated
        if (!socket.userId || socket.userId.toString() !== userId.toString()) {
          return;
        }

        // Verify conversation exists and user is participant
        const conversation = await Conversation.findById(conversationId);
        if (conversation && conversation.isParticipant(userId)) {
          // Broadcast typing indicator to conversation room (excluding sender)
          socket.to(conversationId.toString()).emit('typing_indicator', {
            conversationId,
            userId,
            userName,
            isTyping,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Error handling typing indicator:', error);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
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
app.use('/api/chat', chatRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
