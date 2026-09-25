const Review = require('../models/Review');
const Booking = require('../models/Booking');
const User = require('../models/User');

// @desc    Add review for a provider
// @route   POST /api/reviews
// @access  Private (Customer only)
const createReview = async (req, res) => {
    try {
        const { provider, rating, comment, bookingId } = req.body;

        // 1. Validation check
        if (!provider || !rating || !bookingId) {
            return res.status(400).json({ message: 'Provider, rating, and booking ID are required.' });
        }

        // 2. Rating range check (1 to 5)
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
        }

        // 3. Verify completed booking
        const booking = await Booking.findOne({
            _id: bookingId,
            customer: req.user._id,
            provider,
            status: 'completed'
        });

        if (!booking) {
            return res.status(400).json({ 
                message: 'Booking must be completed before submitting a review.'
            });
        }

        if (booking.isReviewed) {
            return res.status(400).json({
                message: 'You have already submitted a review for this booking.'
            });
        }

        // 4. Create Review
        const review = await Review.create({
            booking: bookingId,
            customer: req.user._id,
            provider,
            rating,
            comment
        });

        // 5. Mark booking as reviewed
        booking.isReviewed = true;
        await booking.save();

        console.log(`✅ [BACKEND] Booking ${bookingId} successfully marked as isReviewed: true`);

        // 6. Update provider rating average
        const allReviews = await Review.find({ provider });
        const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
        await User.findByIdAndUpdate(provider, { rating: Number(avgRating.toFixed(1)) });

        const updatedBooking = await Booking.findById(bookingId)
            .populate('customer', 'name email phone profileImage')
            .populate('provider', 'name email phone category priceStarting profileImage');

        res.status(201).json({
            review,
            booking: updatedBooking
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get reviews for a specific provider
// @route   GET /api/reviews/provider/:providerId
// @access  Public
const getProviderReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ provider: req.params.providerId })
            .populate('customer', 'name profileImage')
            .sort({ createdAt: -1 });

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createReview,
    getProviderReviews
};
