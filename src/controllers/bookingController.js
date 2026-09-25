const Booking = require('../models/Booking');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const sendNotification = require('../utils/pushNotification');

const populateBooking = (query) =>
    query
        .populate('customer', 'name email phone profileImage')
        .populate('provider', 'name email phone category priceStarting profileImage');

// @desc    Create a new service booking with price snapshot & overlap protection
// @route   POST /api/bookings
// @access  Private (Customer Only)
const createBooking = async (req, res) => {
    try {
        // 1. Role Checking
        if (req.user.role !== 'customer') {
            return res.status(403).json({ message: 'Only customers can create bookings.' });
        }

        const { provider, categoryName, bookingDate, address } = req.body;

        if (!provider || !categoryName || !bookingDate || !address) {
            return res.status(400).json({
                message: 'Provider, category name, booking date, and address are required.'
            });
        }

        // 2. Fetch Provider Profile for Price Snapshot
        const providerProfile = await User.findById(provider);
        if (!providerProfile || providerProfile.role !== 'provider') {
            return res.status(404).json({ message: 'Service provider not found.' });
        }

        // 3. OVERLAP PROTECTION LOGIC
        const targetDate = new Date(bookingDate);

        // A provider requires at least a 2-hour window per job.
        // Check for any overlapping bookings within +/- 2 hours.
        const twoHoursInMs = 2 * 60 * 60 * 1000;
        const startTime = new Date(targetDate.getTime() - twoHoursInMs);
        const endTime = new Date(targetDate.getTime() + twoHoursInMs);

        const isOverlapping = await Booking.findOne({
            provider: provider,
            status: { $in: ['pending', 'accepted'] },
            bookingDate: {
                $gte: startTime,
                $lte: endTime
            }
        });

        if (isOverlapping) {
            return res.status(400).json({
                message: 'This provider is busy during the selected time slot. Please choose another time.'
            });
        }

        // 4. Create Booking with Price Snapshot
        const created = await Booking.create({
            customer: req.user._id,
            provider,
            categoryName,
            bookingDate,
            address,
            bookedPrice: providerProfile.priceStarting || 0
        });

        const booking = await populateBooking(Booking.findById(created._id));
        const io = req.app.get('io');
        if (io) {
            io.to(provider.toString()).emit('booking_created', booking);
        }

        // Send Notification to Provider
        await sendNotification({
            app: req.app,
            userId: provider,
            title: 'New Booking Request! 📬',
            body: `${req.user.name} sent a booking request for ${categoryName}.`,
            type: 'booking_created',
            data: { bookingId: created._id.toString(), status: 'pending' }
        });

        res.status(201).json(booking);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get bookings related to logged-in user
// @route   GET /api/bookings
// @access  Private
const getMyBookings = async (req, res) => {
    try {
        const filter = req.user.role === 'provider'
            ? { provider: req.user._id }
            : { customer: req.user._id };

        const bookings = await populateBooking(Booking.find(filter)).sort({ createdAt: -1 });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update booking status with verification logic (Accepted generates OTP, Completed matches OTP)
// @route   PUT /api/bookings/:id/status
// @access  Private
const updateBookingStatus = async (req, res) => {
    try {
        const { status, otp } = req.body;
        const validStatuses = ['pending', 'accepted', 'rejected', 'completed', 'cancelled'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        // Security check: Block unauthorized user status updates
        if (req.user.role === 'customer' && booking.customer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Customers can only update their own bookings.' });
        }
        if (req.user.role === 'provider' && booking.provider.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Providers can only update their own bookings.' });
        }

        // Action control rules
        if (req.user.role === 'customer' && !['rejected', 'cancelled'].includes(status)) {
            return res.status(403).json({ message: 'Customers can only cancel or reject bookings.' });
        }
        if (req.user.role === 'provider' && !['accepted', 'rejected', 'completed', 'cancelled'].includes(status)) {
            return res.status(403).json({ message: 'Invalid booking status for provider.' });
        }

        // WHEN PROVIDER ACCEPTS ORDER: Generate 4-digit code and send to customer via email
        if (status === 'accepted' && req.user.role === 'provider') {
            const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
            booking.completionOtp = randomCode;

            populateBooking(Booking.findById(booking._id)).then((fullBookingDetails) => {
                if (fullBookingDetails && fullBookingDetails.customer) {
                    sendEmail({
                        email: fullBookingDetails.customer.email,
                        subject: 'Job Verification Code - LocalServe',
                        message: `Your booking has been accepted by ${req.user.name}. Your secure verification code is: ${randomCode}. Share this with the provider ONLY after work is fully completed.`,
                        html: `<h3>Your Booking Has Been Accepted!</h3>
                               <p>Expert <b>${req.user.name}</b> is on the way.</p>
                               <p>Please share the secure job verification code below with the expert <b>ONLY AFTER work is 100% completed</b>:</p>
                               <h2 style="color: #10B981; font-size: 36px; letter-spacing: 3px; background: #F1F5F9; padding: 10px; display: inline-block;">${randomCode}</h2>
                               <p style="color: #EF4444; font-weight: bold;">⚠️ Warning: Do not share this code before completion.</p>`
                    }).catch((emailErr) => console.error('Background email error:', emailErr));
                }
            }).catch((err) => console.error('Populate details error:', err));
        }

        // WHEN PROVIDER COMPLETES ORDER: Match customer's OTP
        if (status === 'completed' && req.user.role === 'provider') {
            if (!otp) {
                return res.status(400).json({ message: 'Completion verification code (4-digit OTP) from customer is required.' });
            }
            if (booking.completionOtp !== otp.toString().trim()) {
                return res.status(400).json({ message: 'Invalid verification code. Please request the correct code from the customer.' });
            }
            booking.completionOtp = undefined;
        }

        booking.status = status || booking.status;
        await booking.save();

        const updatedBooking = await populateBooking(Booking.findById(booking._id));
        const io = req.app.get('io');
        if (io) {
            io.to(booking.customer.toString()).emit('booking_status_updated', updatedBooking);
            io.to(booking.provider.toString()).emit('booking_status_updated', updatedBooking);
        }

        // Send Notification to recipient
        const targetUserId = req.user.role === 'provider' ? booking.customer : booking.provider;
        await sendNotification({
            app: req.app,
            userId: targetUserId,
            title: `Booking Update: ${status.toUpperCase()} 📬`,
            body: `Booking status changed to '${status}' by ${req.user.name}.`,
            type: 'booking_status',
            data: { bookingId: booking._id.toString(), status }
        });

        res.json(updatedBooking);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createBooking,
    getMyBookings,
    updateBookingStatus
};
