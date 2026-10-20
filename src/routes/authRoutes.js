const express = require('express');
const router = express.Router();
const {
    sendOtpBeforeRegister,
    verifyOtpBeforeRegister,
    registerComplete,
    forgotPassword,
    resetPassword,
    loginUser,
    getProfile,
    updateProfile,
    deleteUser
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadImage } = require('../utils/cloudinary');
const rateLimit = require('express-rate-limit');

const otpRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many code requests. Please try again later.' }
});

const otpVerificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many verification attempts. Please try again later.' }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many login attempts. Please try again later.' }
});

// Pre-Verification Flow Routes
router.post('/send-otp', otpRequestLimiter, sendOtpBeforeRegister);
router.post('/verify-otp', otpVerificationLimiter, verifyOtpBeforeRegister);
router.post('/register-complete', otpVerificationLimiter, uploadImage, registerComplete);

// Forgot Password Flow Routes
router.post('/forgot-password', otpRequestLimiter, forgotPassword);
router.post('/reset-password', otpVerificationLimiter, resetPassword);

router.post('/login', loginLimiter, loginUser);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, uploadImage, updateProfile);
router.delete('/profile', authMiddleware, deleteUser);

module.exports = router;
