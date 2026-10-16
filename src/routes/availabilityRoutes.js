const express = require('express');
const router = express.Router();
const {
  createAvailability,
  updateAvailability,
  getAvailability,
  getMyAvailability,
  deleteAvailability,
  checkSlotAvailability,
  checkConflicts,
  bookTimeSlot,
  releaseTimeSlot,
} = require('../controllers/availabilityController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes (no auth) — must be registered before auth middleware
router.get('/check', checkSlotAvailability);
router.post('/check-conflicts', checkConflicts);
router.get('/', getAvailability);

// Protected routes
router.use(authMiddleware);

router.post('/', createAvailability);
router.put('/:availabilityId', updateAvailability);
router.get('/my', getMyAvailability);
router.delete('/:availabilityId', deleteAvailability);
router.post('/book', bookTimeSlot);
router.post('/release/:bookingId', releaseTimeSlot);

module.exports = router;
