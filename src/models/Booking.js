const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    // 1. Customer User ID
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 2. Provider User ID
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 3. Service Category Name
    categoryName: {
        type: String,
        required: true
    },
    // 4. Booking Scheduled Date and Time
    bookingDate: {
        type: Date,
        required: true
    },
    // 5. Service Address
    address: {
        type: String,
        required: true
    },
    // 6. Booking Status
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
        default: 'pending'
    },

    // 7. Price Snapshot
    bookedPrice: {
        type: Number,
        default: 0
    },

    // 8. Completion Verification OTP (4-digit code)
    completionOtp: {
        type: String,
        default: undefined
    },

    // 9. Review Status Flag
    isReviewed: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Booking', bookingSchema);
