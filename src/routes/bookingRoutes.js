const express = require('express');
const router = express.Router();
const { 
    createBooking, 
    getMyBookings, 
    updateBookingStatus 
} = require('../controllers/bookingController');
const authMiddleware = require('../middleware/authMiddleware');

// Tamam booking endpoints
router.post('/', authMiddleware, createBooking);
router.get('/', authMiddleware, getMyBookings);
router.put('/:id/status', authMiddleware, updateBookingStatus);

module.exports = router;