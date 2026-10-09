const Availability = require('../models/Availability');
const Booking = require('../models/Booking');
const User = require('../models/User');

// Create availability for a specific date
exports.createAvailability = async (req, res) => {
  try {
    const { date, timeSlots, note } = req.body;
    const providerId = req.user.id;

    // Verify user is a provider
    const user = await User.findById(providerId);
    if (user.role !== 'provider') {
      return res.status(403).json({ message: 'Only providers can create availability' });
    }

    // Check if availability already exists for this date
    const existingAvailability = await Availability.findOne({
      provider: providerId,
      date: new Date(date),
    });

    if (existingAvailability) {
      return res.status(400).json({ message: 'Availability already exists for this date' });
    }

    // Validate time slots
    const validTimeSlots = timeSlots.filter(slot => {
      return slot.startTime && slot.endTime && slot.startTime < slot.endTime;
    });

    if (validTimeSlots.length === 0) {
      return res.status(400).json({ message: 'At least one valid time slot is required' });
    }

    // Create availability
    const availability = await Availability.create({
      provider: providerId,
      date: new Date(date),
      timeSlots: validTimeSlots,
      note: note || '',
    });

    res.status(201).json(availability);
  } catch (error) {
    console.error('Error creating availability:', error);
    res.status(500).json({ 
      message: 'Error creating availability',
      error: error.message 
    });
  }
};

// Update availability for a specific date
exports.updateAvailability = async (req, res) => {
  try {
    const { availabilityId } = req.params;
    const { timeSlots, isAvailable, note } = req.body;
    const providerId = req.user._id;

    const availability = await Availability.findById(availabilityId);

    if (!availability) {
      return res.status(404).json({ message: 'Availability not found' });
    }

    // Verify ownership
    if (availability.provider.toString() !== providerId) {
      return res.status(403).json({ message: 'Not authorized to update this availability' });
    }

    // Update fields
    if (timeSlots) {
      // Only update available slots, keep booked slots unchanged
      const currentTimeSlots = availability.timeSlots;
      const newTimeSlots = timeSlots.filter(slot => slot.isAvailable);
      
      availability.timeSlots = [
        ...currentTimeSlots.filter(slot => !slot.isAvailable),
        ...newTimeSlots
      ];
    }

    if (isAvailable !== undefined) {
      availability.isAvailable = isAvailable;
    }

    if (note !== undefined) {
      availability.note = note;
    }

    await availability.save();

    res.status(200).json(availability);
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ 
      message: 'Error updating availability',
      error: error.message 
    });
  }
};

// Get availability for a date range
exports.getAvailability = async (req, res) => {
  try {
    const { providerId, startDate, endDate } = req.query;
    const userId = req.user._id;

    // Verify provider exists
    const provider = await User.findById(providerId);
    if (!provider || provider.role !== 'provider') {
      return res.status(404).json({ message: 'Provider not found' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    const availability = await Availability.getAvailabilityInRange(
      providerId,
      startDate,
      endDate
    );

    res.status(200).json(availability);
  } catch (error) {
    console.error('Error getting availability:', error);
    res.status(500).json({ 
      message: 'Error getting availability',
      error: error.message 
    });
  }
};

// Get provider's own availability
exports.getMyAvailability = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const providerId = req.user._id;

    // Verify user is a provider
    const user = await User.findById(providerId);
    if (user.role !== 'provider') {
      return res.status(403).json({ message: 'Only providers can view their availability' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    const availability = await Availability.getAvailabilityInRange(
      providerId,
      startDate,
      endDate
    );

    res.status(200).json(availability);
  } catch (error) {
    console.error('Error getting my availability:', error);
    res.status(500).json({ 
      message: 'Error getting availability',
      error: error.message 
    });
  }
};

// Delete availability for a specific date
exports.deleteAvailability = async (req, res) => {
  try {
    const { availabilityId } = req.params;
    const providerId = req.user._id;

    const availability = await Availability.findById(availabilityId);

    if (!availability) {
      return res.status(404).json({ message: 'Availability not found' });
    }

    // Verify ownership
    if (availability.provider.toString() !== providerId) {
      return res.status(403).json({ message: 'Not authorized to delete this availability' });
    }

    // Check if there are any booked slots
    const hasBookedSlots = availability.timeSlots.some(slot => !slot.isAvailable);
    if (hasBookedSlots) {
      return res.status(400).json({ 
        message: 'Cannot delete availability with booked slots' 
      });
    }

    await Availability.findByIdAndDelete(availabilityId);

    res.status(200).json({ message: 'Availability deleted successfully' });
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({ 
      message: 'Error deleting availability',
      error: error.message 
    });
  }
};

// Check if a specific time slot is available
exports.checkSlotAvailability = async (req, res) => {
  try {
    const { providerId, date, startTime, endTime } = req.query;

    if (!providerId || !date || !startTime || !endTime) {
      return res.status(400).json({ 
        message: 'Provider ID, date, start time, and end time are required' 
      });
    }

    const isAvailable = await Availability.isSlotAvailable(
      providerId,
      date,
      startTime,
      endTime
    );

    res.status(200).json({ isAvailable });
  } catch (error) {
    console.error('Error checking slot availability:', error);
    res.status(500).json({ 
      message: 'Error checking slot availability',
      error: error.message 
    });
  }
};

// Book a time slot (called when booking is created)
exports.bookTimeSlot = async (req, res) => {
  try {
    const { providerId, date, startTime, endTime, bookingId } = req.body;
    const userId = req.user.id;

    // Verify booking exists and belongs to user
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.customer.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to book for this booking' });
    }

    if (booking.provider.toString() !== providerId) {
      return res.status(400).json({ message: 'Booking provider mismatch' });
    }

    // Book the time slot
    const availability = await Availability.bookTimeSlot(
      providerId,
      date,
      startTime,
      endTime,
      bookingId
    );

    res.status(200).json(availability);
  } catch (error) {
    console.error('Error booking time slot:', error);
    res.status(500).json({ 
      message: 'Error booking time slot',
      error: error.message 
    });
  }
};

// Release a booked time slot (called when booking is cancelled)
exports.releaseTimeSlot = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user._id;

    // Verify booking exists and belongs to user
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.customer.toString() !== userId && booking.provider.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to release this booking' });
    }

    // Release the time slot
    await Availability.releaseTimeSlot(bookingId);

    res.status(200).json({ message: 'Time slot released successfully' });
  } catch (error) {
    console.error('Error releasing time slot:', error);
    res.status(500).json({ 
      message: 'Error releasing time slot',
      error: error.message 
    });
  }
};