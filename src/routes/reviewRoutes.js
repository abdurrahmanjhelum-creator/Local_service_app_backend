const express = require('express');
const router = express.Router();
const { 
    createReview, 
    getProviderReviews 
} = require('../controllers/reviewController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route: Fetch reviews for a specific provider
router.get('/provider/:providerId', getProviderReviews);

// Protected route: Post a new review
router.post('/', authMiddleware, createReview);

module.exports = router;
