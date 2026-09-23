const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    // 1. Optional booking reference if the review is tied to a specific booking
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null
    },
    // 2. Review dene wale Customer ki ID
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 3. Jis Provider ko review mila uski ID
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 4. Rating (1 se 5 Stars)
    rating: {
        type: Number,
        required: [true, 'Rating dena zaroori hai'],
        min: 1,
        max: 5
    },
    // 5. Customer ka comment/feedback
    comment: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Review', reviewSchema);