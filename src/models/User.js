const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: [true, 'Password is required']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required']
    },
    profileImage: {
        type: String,
        default: ''
    },
    role: {
        type: String,
        enum: ['customer', 'provider'],
        default: 'customer'
    },
    fcmToken: {
        type: String,
        default: ''
    },
    // Service Provider Specific Fields
    category: {
        type: String,
        default: '' // e.g., 'Electrician', 'Plumber'
    },
    priceStarting: {
        type: Number,
        default: 0
    },
    experienceYears: {
        type: Number,
        default: 0
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    rating: {
        type: Number,
        default: 5.0
    },
    isVerified: {
        type: Boolean,
        default: false // Shuru me false rahega, OTP verify hone par true hoga
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt fields
});

module.exports = mongoose.model('User', userSchema);
