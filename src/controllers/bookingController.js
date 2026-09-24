const Booking = require('../models/Booking');
const User = require('../models/User'); // User model pull kiya provider ka current rate aur profile fetch karne ke liye
const sendEmail = require('../utils/sendEmail'); // Completion OTP email par bejne ke liye helper import kiya
const sendNotification = require('../utils/pushNotification'); // Notification helper

const populateBooking = (query) =>
    query
        .populate('customer', 'name email phone profileImage')
        .populate('provider', 'name email phone category priceStarting profileImage');

// @desc    Create a new service booking with price snapshot & overlap protection
// @route   POST /api/bookings
// @access  Private (Customer Only)
const createBooking = async (req, res) => {
    try {
        // 1. Strict Role Checking
        if (req.user.role !== 'customer') {
            return res.status(403).json({ message: 'Sirf customers booking create kar sakte hain' });
        }

        const { provider, categoryName, bookingDate, address } = req.body;

        if (!provider || !categoryName || !bookingDate || !address) {
            return res.status(400).json({
                message: 'Provider, categoryName, bookingDate aur address dena zaroori hai'
            });
        }

        // 2. Fetch Provider Profile for Price Snapshot
        const providerProfile = await User.findById(provider);
        if (!providerProfile || providerProfile.role !== 'provider') {
            return res.status(404).json({ message: 'Service expert/provider nahi mila' });
        }

        // 3. 🛡️ DOUBLE BOOKING / OVERLAP PROTECTION LOGIC
        const targetDate = new Date(bookingDate);

        // Aik expert ko aik service ke liye kam az kam 2 ghante chahiye hote hain.
        // Hum check karenge ke is selected time se 2 ghante pehle ya 2 ghante baad koi job pehle se book to nahi hai.
        const twoHoursInMs = 2 * 60 * 60 * 1000;
        const startTime = new Date(targetDate.getTime() - twoHoursInMs);
        const endTime = new Date(targetDate.getTime() + twoHoursInMs);

        const isOverlapping = await Booking.findOne({
            provider: provider,
            status: { $in: ['pending', 'accepted'] }, // Agar job pehle se waiting ya accept ho chuki hai
            bookingDate: {
                $gte: startTime,
                $lte: endTime
            }
        });

        if (isOverlapping) {
            return res.status(400).json({
                message: 'Yeh expert is time slot par pehle se busy hain. Kripya koi doosra time chuney.'
            });
        }

        // 4. Create Booking with Price Snapshot freeze
        const created = await Booking.create({
            customer: req.user._id,
            provider,
            categoryName,
            bookingDate,
            address,
            bookedPrice: providerProfile.priceStarting || 0 // 💰 Price snapshot locked securely!
        });

        const booking = await populateBooking(Booking.findById(created._id));
        const io = req.app.get('io');
        if (io) {
            io.to(provider.toString()).emit('booking_created', booking);
        }

        // 🔔 Send Notification to Provider
        await sendNotification({
            app: req.app,
            userId: provider,
            title: 'Nayi Booking Request! 📬',
            body: `${req.user.name} ne ${categoryName} ke liye booking bheji hai.`,
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

// @desc    Update booking status with verification logic (Accepted handles OTP generate, Completed matches OTP)
// @route   PUT /api/bookings/:id/status
// @access  Private
const updateBookingStatus = async (req, res) => {
    try {
        const { status, otp } = req.body; // Flutter body se status ke sath OTP bhi bhej sakta hai
        const validStatuses = ['pending', 'accepted', 'rejected', 'completed', 'cancelled'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: 'Booking nahi mili' });
        }

        // Security check: Kisi doosre user ki booking update karne se block karein
        if (req.user.role === 'customer' && booking.customer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Customer sirf apni booking update kar sakta hai' });
        }
        if (req.user.role === 'provider' && booking.provider.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Provider sirf apni booking update kar sakta hai' });
        }

        // Action control rules
        if (req.user.role === 'customer' && !['rejected', 'cancelled'].includes(status)) {
            return res.status(403).json({ message: 'Customer sirf booking cancel/reject kar sakta hai' });
        }
        if (req.user.role === 'provider' && !['accepted', 'rejected', 'completed', 'cancelled'].includes(status)) {
            return res.status(403).json({ message: 'Provider ke liye invalid booking status' });
        }

        // 🔄 ====== 🚨 REAL-WORLD SECURITY LOGIC FOR STATUS CHANGING ======

        // A. JAB PROVIDER ORDER ACCEPT KARE: Hum dynamic 4-digit token generate karke customer ko email bhejenge
        if (status === 'accepted' && req.user.role === 'provider') {
            const randomCode = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit code
            booking.completionOtp = randomCode;

            // Trigger email send asynchronously in background to avoid blocking HTTP response
            populateBooking(Booking.findById(booking._id)).then((fullBookingDetails) => {
                if (fullBookingDetails && fullBookingDetails.customer) {
                    sendEmail({
                        email: fullBookingDetails.customer.email,
                        subject: 'Job Security Code - Local Services',
                        message: `Your booking has been accepted by ${req.user.name}. Your secure verification code is: ${randomCode}. Share this with the provider ONLY after your work is fully done.`,
                        html: `<h3>Your Booking is Accepted!</h3>
                               <p>Expert <b>${req.user.name}</b> is on the way.</p>
                               <p>Please share the secure job verification OTP below with the expert <b>ONLY AFTER the work is 100% completed</b>:</p>
                               <h2 style="color: #10B981; font-size: 36px; letter-spacing: 3px; background: #F1F5F9; padding: 10px; display: inline-block;">${randomCode}</h2>
                               <p style="color: #EF4444; font-weight: bold;">⚠️ Warning: Do not share this code before completion to avoid billing disputes!</p>`
                    }).catch((emailErr) => console.error('Background email error:', emailErr));
                }
            }).catch((err) => console.error('Populate details error:', err));
        }

        // B. 🔒 JAB PROVIDER ORDER COMPLETED KARE: Customer ka diya hua OTP match hona chahiye, warna operation strict block!
        if (status === 'completed' && req.user.role === 'provider') {
            if (!otp) {
                return res.status(400).json({ message: 'Kaam poora karne ke liye customer ka 4-Digit OTP enter karna zaroori hai.' });
            }
            if (booking.completionOtp !== otp.toString().trim()) {
                return res.status(400).json({ message: 'Galat OTP code! Kripya customer se sahi code pooch kar dobara enter karein.' });
            }
            // OTP match ho gaya, ab system database se code flush/clear kar dega safety ke liye
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

        // 🔔 Send Notification to opposite party
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
