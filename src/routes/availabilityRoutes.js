const express = require('express');
const router = express.Router();
const {
  createAvailability,
  updateAvailability,
  getAvailability,
  getMyAvailability,
  deleteAvailability,
  checkSlotAvailability,
  bookTimeSlot,
  releaseTimeSlot,
} = require('../controllers/availabilityController');
const authMiddleware = require('../middleware/authMiddleware');

// All availability routes require authentication
router.use(authMiddleware);

// Create availability (provider only)
router.post('/', createAvailability);

// Update availability (provider only)
router.put('/:availabilityId', updateAvailability);

// Check if a specific time slot is available (public)
router.get('/check', checkSlotAvailability);

// Get availability for a provider (public)
router.get('/', getAvailability);

// Get my availability (provider only)
router.get('/my', getMyAvailability);

// Delete availability (provider only)
router.delete('/:availabilityId', deleteAvailability);

// Book a time slot (when creating booking)
router.post('/book', bookTimeSlot);

// Release a time slot (when cancelling booking)
router.post('/release/:bookingId', releaseTimeSlot);

module.exports = router;