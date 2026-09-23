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
// TAREEQA 2: PRE-VERIFICATION OTP FLOW CONTROLLERS
// ========================================================

// 1. Send OTP to Email (Pehle stage par sirf email check hogi)
const sendOtpBeforeRegister = async (req, res) => {
    try {
        const { email } = req.body || {};

        if (!email) {
            return res.status(400).json({ message: 'Email dena zaroori hai' });
        }

        // Check karein ke kahin user pehle se registered toh nahi hai
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'Yeh email pehle se register hai. Login karein.' });
        }

        // 6-Digit Random OTP Generate karein
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

        // Agar is email ka purana OTP pada hai toh use pehle delete kar dein (Clean state)
        await OTP.deleteMany({ email });

        // OTP Collection me save karein
        await OTP.create({
            email,
            otp: generatedOtp
        });

        // Email send karein
        await sendEmail({
            email: email,
            subject: 'Email Verification - Local Services App',
            message: `Your verification OTP code is: ${generatedOtp}. Valid for 5 minutes.`,
            html: `<h3>Account Verification</h3>
                   <p>Please use the following OTP to verify your email address:</p>
                   <h2 style="color: #0D9488; font-size: 32px; letter-spacing: 2px;">${generatedOtp}</h2>
                   <p>This code will expire in 5 minutes.</p>`
        });

        res.status(200).json({ message: 'Verification OTP aapki email par bhej diya gaya hai.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Verify OTP (User ka entered code check karna)
const verifyOtpBeforeRegister = async (req, res) => {
    try {
        const { email, otp } = req.body || {};

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email aur OTP dena zaroori hai' });
        }

        // Database se is email ka recent OTP dhundhein
        const otpRecord = await OTP.findOne({ email, otp });

        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid OTP code ya code expire ho chuka hai' });
        }

        // OTP sahi hai! Hamein temporary verification delete karni hai taake dobara use na ho sake
        await OTP.deleteOne({ _id: otpRecord._id });

        res.status(200).json({
            success: true,
            message: 'Email successfully verify ho gayi hai! Ab aap account create kar sakte hain.'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Register Complete (Jab email verify ho jaye, tab baqi details save hongi)
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
            return res.status(400).json({ message: 'Tamam zaroori fields (Name, Email, Password, Phone) dena zaroori hain' });
        }

        // Dobara security check ke kahin double registration na ho jaye
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'Yeh email already register ho chuki hai.' });
        }

        const passwordhash = await bcrypt.hash(password, 10);

        const imageUrl = req.file
            ? (req.file.path.startsWith('http') ? req.file.path : `/uploads/${req.file.filename}`)
            : (profileImage || '');

        // Account create karein direct 'isVerified: true' ke sath kyunki OTP pehle verify ho chuka hai
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
            isVerified: true // 🔥 Pre-verified code flow complete!
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

// 1. Forgot Password - Send OTP (User email enter karega, hum use naya OTP bhejenge)
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body || {};

        if (!email) {
            return res.status(400).json({ message: 'Email dena zaroori hai' });
        }

        // Pehle check karein ke kya yeh email database me exist karti bhi hai ya nahi
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Is email par koi account nahi mila.' });
        }

        // 6-Digit Random OTP Generate karein
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

        // Agar purana koi OTP pada hai is email ka toh delete karein
        await OTP.deleteMany({ email });

        // OTP collection me save karein
        await OTP.create({
            email,
            otp: generatedOtp
        });

        // Email send karein
        await sendEmail({
            email: email,
            subject: 'Reset Password OTP - Local Services App',
            message: `Your OTP code to reset password is: ${generatedOtp}. Valid for 5 minutes.`,
            html: `<h3>Reset Your Password</h3>
                   <p>We received a request to reset your password. Use the OTP code below to proceed:</p>
                   <h2 style="color: #EF4444; font-size: 32px; letter-spacing: 2px;">${generatedOtp}</h2>
                   <p>This code will expire in 5 minutes. If you didn't request this, please ignore this email.</p>`
        });

        res.status(200).json({ message: 'Password reset OTP aapki email par bhej diya gaya hai.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Reset Password (User background email, OTP aur naya password enter karega)
const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body || {};

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'Email, OTP aur Naya Password dena zaroori hai' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password kam az kam 6 characters ka hona chahiye' });
        }

        // OTP token match karein database se
        const otpRecord = await OTP.findOne({ email, otp });
        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid OTP code ya code expire ho chuka hai' });
        }

        // OTP sahi hai! User ko find karein
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User nahi mila.' });
        }

        // Naye password ko hash karein
        const passwordhash = await bcrypt.hash(newPassword, 10);

        // Password update karein
        user.password = passwordhash;
        await user.save();

        // Kaam khatam hone ke baad temporary OTP delete kar dein
        await OTP.deleteOne({ _id: otpRecord._id });

        res.status(200).json({ success: true, message: 'Password successfully change ho gaya hai! Ab aap naye password se login kar sakte hain.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4. Authenticate user & get token (Login)
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ message: 'Email aur password dena zaroori hai' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'User Not Found' });
        }

        const passwordcheck = await bcrypt.compare(password, user.password);
        if (!passwordcheck) {
            return res.status(401).json({ message: 'Invalid password' });
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
            return res.status(404).json({ message: 'User nahi mila' });
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
            return res.status(404).json({ message: 'User nahi mila' });
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
            return res.status(404).json({ message: 'User nahi mila' });
        }

        await Booking.deleteMany({
            $or: [
                { customer: userId },
                { provider: userId }
            ]
        });

        await User.findByIdAndDelete(userId);
        res.json({ message: 'Account aur related data safalta purvak delete ho gaya hai' });
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
