const User = require('../models/User');
const Booking = require('../models/Booking');
const OTP = require('../models/OTP');
const sendEmail = require('../utils/sendEmail');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');

const formatUser = (user, token) => {
    const data = {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage || '',
        category: user.category || '',
        priceStarting: user.priceStarting || 0,
        experienceYears: user.experienceYears || 0,
        isAvailable: user.isAvailable,
        rating: user.rating
    };

    if (token) {
        data.token = token;
    }

    return data;
};

// ========================================================
// PRE-VERIFICATION OTP FLOW CONTROLLERS
// ========================================================

// 1. Send OTP to Email (Initial stage email check)
const sendOtpBeforeRegister = async (req, res) => {
    try {
        const { email } = req.body || {};

        if (!email) {
            return res.status(400).json({ message: 'Email address is required.' });
        }

        // Check if user is already registered
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'This email is already registered. Please log in.' });
        }

        // Generate 6-Digit Random OTP
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

        // Delete any existing OTP for this email
        await OTP.deleteMany({ email });

        // Save OTP to Collection
        await OTP.create({
            email,
            otp: generatedOtp
        });

        // Send Email
        await sendEmail({
            email: email,
            subject: 'Email Verification - LocalServe',
            message: `Your verification OTP code is: ${generatedOtp}. Valid for 5 minutes.`,
            html: `<h3>Account Verification</h3>
                   <p>Please use the following OTP to verify your email address:</p>
                   <h2 style="color: #0D9488; font-size: 32px; letter-spacing: 2px;">${generatedOtp}</h2>
                   <p>This code will expire in 5 minutes.</p>`
        });

        res.status(200).json({ message: 'Verification OTP has been sent to your email.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Verify OTP (Validate entered code)
const verifyOtpBeforeRegister = async (req, res) => {
    try {
        const { email, otp } = req.body || {};

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required.' });
        }

        // Find recent OTP for this email
        const otpRecord = await OTP.findOne({ email, otp });

        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid or expired OTP code.' });
        }

        // Delete temporary OTP record
        await OTP.deleteOne({ _id: otpRecord._id });

        res.status(200).json({
            success: true,
            message: 'Email verified successfully. You can now complete registration.'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Register Complete (Save user details after email verification)
const registerComplete = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            role,
            phone,
            category,
            priceStarting,
            experienceYears,
            profileImage
        } = req.body || {};

        if (!name || !email || !password || !phone) {
            return res.status(400).json({ message: 'All required fields (Name, Email, Password, Phone) must be provided.' });
        }

        // Double registration check
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'This email is already registered.' });
        }

        const passwordhash = await bcrypt.hash(password, 10);

        const imageUrl = req.file
            ? (req.file.path.startsWith('http') ? req.file.path : `/uploads/${req.file.filename}`)
            : (profileImage || '');

        // Create account with isVerified: true since OTP was verified beforehand
        const user = await User.create({
            name,
            email,
            password: passwordhash,
            role: role || 'customer',
            phone,
            profileImage: imageUrl,
            category: role === 'provider' ? category || '' : '',
            priceStarting: role === 'provider' ? Number(priceStarting ?? 0) : 0,
            experienceYears: role === 'provider' ? Number(experienceYears ?? 0) : 0,
            isAvailable: role === 'provider' ? true : undefined,
            isVerified: true
        });

        if (user) {
            res.status(201).json(formatUser(user, generateToken(user._id)));
        } else {
            res.status(400).json({ message: 'Account creation failed.' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ========================================================
// FORGOT PASSWORD FLOW CONTROLLERS
// ========================================================

// 1. Forgot Password - Send OTP
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body || {};

        if (!email) {
            return res.status(400).json({ message: 'Email address is required.' });
        }

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'No account found with this email address.' });
        }

        // Generate 6-Digit Random OTP
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

        // Delete previous OTP
        await OTP.deleteMany({ email });

        // Save OTP
        await OTP.create({
            email,
            otp: generatedOtp
        });

        // Send Email
        await sendEmail({
            email: email,
            subject: 'Reset Password OTP - LocalServe',
            message: `Your OTP code to reset password is: ${generatedOtp}. Valid for 5 minutes.`,
            html: `<h3>Reset Your Password</h3>
                   <p>We received a request to reset your password. Use the OTP code below to proceed:</p>
                   <h2 style="color: #EF4444; font-size: 32px; letter-spacing: 2px;">${generatedOtp}</h2>
                   <p>This code will expire in 5 minutes. If you didn't request this, please ignore this email.</p>`
        });

        res.status(200).json({ message: 'Password reset OTP has been sent to your email.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Reset Password
const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body || {};

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'Email, OTP, and New Password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
        }

        // Match OTP token
        const otpRecord = await OTP.findOne({ email, otp });
        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid or expired OTP code.' });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Hash new password
        const passwordhash = await bcrypt.hash(newPassword, 10);

        // Update password
        user.password = passwordhash;
        await user.save();

        // Delete temporary OTP record
        await OTP.deleteOne({ _id: otpRecord._id });

        res.status(200).json({ success: true, message: 'Password changed successfully. You can now log in with your new password.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4. Authenticate user & get token (Login)
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'User not found.' });
        }

        const passwordcheck = await bcrypt.compare(password, user.password);
        if (!passwordcheck) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        res.json(formatUser(user, generateToken(user._id)));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 5. Update Profile
const updateProfile = async (req, res) => {
    try {
        const allowedFields = ['name', 'phone', 'category', 'priceStarting', 'experienceYears', 'isAvailable'];
        const updates = Object.fromEntries(
            Object.entries(req.body || {}).filter(([key]) => allowedFields.includes(key))
        );

        if (updates.priceStarting !== undefined) {
            updates.priceStarting = Number(updates.priceStarting);
        }
        if (updates.experienceYears !== undefined) {
            updates.experienceYears = Number(updates.experienceYears);
        }
        if (updates.isAvailable !== undefined) {
            updates.isAvailable = updates.isAvailable === true || updates.isAvailable === 'true';
        }

        if (req.file) {
            updates.profileImage = req.file.path.startsWith('http')
                ? req.file.path
                : `/uploads/${req.file.filename}`;
        }

        const user = await User.findByIdAndUpdate(req.user._id, updates, {
            new: true,
            runValidators: true
        }).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.json(formatUser(user));
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// 6. Get Profile
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(formatUser(user));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 7. Delete User Profile
const deleteUser = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        await Booking.deleteMany({
            $or: [
                { customer: userId },
                { provider: userId }
            ]
        });

        await User.findByIdAndDelete(userId);
        res.json({ message: 'Account and all associated data deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    sendOtpBeforeRegister,
    verifyOtpBeforeRegister,
    registerComplete,
    forgotPassword,
    resetPassword,
    loginUser,
    getProfile,
    updateProfile,
    deleteUser
};
