const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    // 1. Book karne wale Customer ki ID
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 2. Jise book kiya ja raha hai us Provider ki ID
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 3. Service ki Category (e.g., Electrician, Plumber)
    categoryName: {
        type: String,
        required: true
    },
    // 4. Kis tareekh aur time par aana hai
    bookingDate: {
        type: Date,
        required: true
    },
    // 5. Gher ka Address jahan service chahiye
    address: {
        type: String,
        required: true
    },
    // 6. Booking ka status (Auto 'pending' hoga start mein)
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
        default: 'pending'
    },

    // ======= 🚀 NEW SECURITY & DISPUTE FIELDS ADDED =======

    // 7. Price Snapshot: Booking karte waqt ka fix rate yahan freeze hoga
    bookedPrice: {
        type: Number,
        default: 0 // Made default 0 instead of required to support older records
    },

    // 8. Completion OTP: Job verification ke liye 4-digit code store hoga
    completionOtp: {
        type: String,
        default: undefined // Shuru mein khali hoga, jab provider accept karega tab generate hoga
    },

    // 9. Review Status: Check karne ke liye ke kya customer ne review de diya hai
    isReviewed: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true // Automated Created Date & Time (createdAt, updatedAt)
});

module.exports = mongoose.model('Booking', bookingSchema);
