const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true
    },
    otp: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        enum: ['registration', 'password_reset'],
        default: 'registration',
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    attempts: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // 🔥 300 seconds = 5 Minutes! 5 minute baad yeh data database se AUTOMATIC delete ho jayega.
    }
});

module.exports = mongoose.model('OTP', otpSchema);