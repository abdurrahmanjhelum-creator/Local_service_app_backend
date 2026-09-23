const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/local_services';

    if (!mongoUri) {
      throw new Error('MongoDB URI is missing. Set MONGODB_URI in your .env file.');
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    console.error('Please make sure MongoDB is running or provide a valid MONGODB_URI in .env');
  }
};

module.exports = connectDB;