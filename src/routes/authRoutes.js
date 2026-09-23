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

// Pre-Verification Flow Routes
router.post('/send-otp', sendOtpBeforeRegister);
router.post('/verify-otp', verifyOtpBeforeRegister);
router.post('/register-complete', uploadImage, registerComplete);

// Forgot Password Flow Routes
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.post('/login', loginUser);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, uploadImage, updateProfile);
router.delete('/profile', authMiddleware, deleteUser);

module.exports = router;
