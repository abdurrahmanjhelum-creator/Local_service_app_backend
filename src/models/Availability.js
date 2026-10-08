const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  timeSlots: [{
    startTime: {
      type: String,
      required: true, // Format: "09:00"
    },
    endTime: {
      type: String,
      required: true, // Format: "10:00"
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
  }],
  isAvailable: {
    type: Boolean,
    default: true,
  },
  note: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

// Compound index for efficient queries
availabilitySchema.index({ provider: 1, date: 1 });
availabilitySchema.index({ provider: 1, date: 1, 'timeSlots.startTime': 1 });

// Static method to get availability for a date range
availabilitySchema.statics.getAvailabilityInRange = async function(providerId, startDate, endDate) {
  return this.find({
    provider: providerId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  }).sort({ date: 1 });
};

// Static method to check if a time slot is available
availabilitySchema.statics.isSlotAvailable = async function(providerId, date, startTime, endTime) {
  const availability = await this.findOne({
    provider: providerId,
    date: new Date(date),
  });

  // If the provider has not created any availability schedule for this date yet,
  // allow the booking to proceed instead of blocking the first booking.
  if (!availability) {
    return true;
  }

  if (!availability.isAvailable) {
    return false;
  }

  // Check if any overlapping slot is booked
  const hasBookedSlot = availability.timeSlots.some(slot => {
    if (!slot.isAvailable) {
      // Check time overlap
      return (
        (startTime >= slot.startTime && startTime < slot.endTime) ||
        (endTime > slot.startTime && endTime <= slot.endTime) ||
        (startTime <= slot.startTime && endTime >= slot.endTime)
      );
    }
    return false;
  });

  return !hasBookedSlot;
};

// Static method to book a time slot
availabilitySchema.statics.bookTimeSlot = async function(providerId, date, startTime, endTime, bookingId) {
  const availability = await this.findOne({
    provider: providerId,
    date: new Date(date),
  });

  // No availability schedule exists yet: skip slot locking and allow booking to proceed.
  if (!availability) {
    return null;
  }

  // Find and book the matching slot
  const slotIndex = availability.timeSlots.findIndex(slot => 
    slot.startTime === startTime && 
    slot.endTime === endTime && 
    slot.isAvailable
  );

  if (slotIndex === -1) {
    throw new Error('Time slot not available');
  }

  availability.timeSlots[slotIndex].isAvailable = false;
  availability.timeSlots[slotIndex].bookingId = bookingId;
  
  await availability.save();
  return availability;
};

// Static method to release a booked time slot
availabilitySchema.statics.releaseTimeSlot = async function(bookingId) {
  const availability = await this.findOne({
    'timeSlots.bookingId': bookingId,
  });

  if (availability) {
    const slotIndex = availability.timeSlots.findIndex(slot => 
      slot.bookingId && slot.bookingId.toString() === bookingId.toString()
    );

    if (slotIndex !== -1) {
      availability.timeSlots[slotIndex].isAvailable = true;
      availability.timeSlots[slotIndex].bookingId = null;
      await availability.save();
    }
  }
};

// Method to get available slots for a specific date
availabilitySchema.methods.getAvailableSlots = function() {
  return this.timeSlots.filter(slot => slot.isAvailable);
};

module.exports = mongoose.model('Availability', availabilitySchema);