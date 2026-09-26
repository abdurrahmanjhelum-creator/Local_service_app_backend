const express = require('express');
const router = express.Router();
const {
    getNearbyProviders,
    updateUserLocation,
    updateServiceRadius,
    calculateDistanceBetweenPoints,
    geocodeAddress
} = require('../controllers/locationController');
const { protect } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/location/nearby
 * @desc    Get nearby providers based on location
 * @access  Public (or Private depending on your requirements)
 */
router.get('/nearby', getNearbyProviders);

/**
 * @route   PUT /api/location/user
 * @desc    Update user's current location
 * @access  Private
 */
router.put('/user', protect, updateUserLocation);

/**
 * @route   PUT /api/location/service-radius
 * @desc    Update provider's service radius
 * @access  Private (Provider only)
 */
router.put('/service-radius', protect, updateServiceRadius);

/**
 * @route   GET /api/location/distance
 * @desc    Calculate distance between two points
 * @access  Public
 */
router.get('/distance', calculateDistanceBetweenPoints);

/**
 * @route   GET /api/location/geocode
 * @desc    Convert address to coordinates
 * @access  Public
 */
router.get('/geocode', geocodeAddress);

module.exports = router;