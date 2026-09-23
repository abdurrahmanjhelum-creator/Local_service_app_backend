const express = require('express');
const router = express.Router();
const { 
    createReview, 
    getProviderReviews 
} = require('../controllers/reviewController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route: Kisi bhi provider ke reviews dekhna
router.get('/provider/:providerId', getProviderReviews);

// Protected route: Review post karne ke liye login token zaroori hai
router.post('/', authMiddleware, createReview);

module.exports = router;