const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState >= 1) {
    isConnected = true;
    return;
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    console.error('⚠️ MONGO_URI is missing in environment variables!');
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      try {
        await mongoose.connect('mongodb://127.0.0.1:27017/local_services', {
          serverSelectionTimeoutMS: 3000
        });
        isConnected = true;
      } catch (err) {
        console.error('Local MongoDB connection failed:', err.message);
      }
    }
    return;
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000 // Fast 5s timeout on Vercel
    });
    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
  }
};

module.exports = connectDB;
