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
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // 🔥 300 seconds = 5 Minutes! 5 minute baad yeh data database se AUTOMATIC delete ho jayega.
    }
});

module.exports = mongoose.model('OTP', otpSchema);