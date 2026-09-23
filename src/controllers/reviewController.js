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
            return res.status(400).json({ message: 'Provider, rating aur bookingId dena zaroori hai' });
        }

        // 2. Check karein ke rating 1 se 5 ke darmiyan hai ya nahi
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating 1 se 5 ke darmiyan honi chahiye' });
        }

        // 3. Verify karein ke kya yeh specific booking complete ho chuki hai aur pehle review nahi hua
        const booking = await Booking.findOne({
            _id: bookingId,
            customer: req.user._id,
            provider,
            status: 'completed'
        });

        if (!booking) {
            return res.status(400).json({ 
                message: 'Review dene ke liye booking ka mukammal (completed) hona zaroori hai'
            });
        }

        if (booking.isReviewed) {
            return res.status(400).json({
                message: 'Aap is booking ke liye pehle hi review de chuke hain'
            });
        }

        // 4. Review create karein
        const review = await Review.create({
            booking: bookingId, // 🔥 Linked the booking ID properly
            customer: req.user._id,
            provider,
            rating,
            comment
        });

        // 5. Booking ko marked karein ke iska review ho gaya hai
        booking.isReviewed = true;
        await booking.save();

        console.log(`✅ [BACKEND] Booking ${bookingId} successfully marked as isReviewed: true`);

        // 6. Update provider rating average
        const allReviews = await Review.find({ provider });
        const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
        await User.findByIdAndUpdate(provider, { rating: Number(avgRating.toFixed(1)) });

        // 🔥 IMPORTANT: Return the updated booking so frontend can sync state immediately
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