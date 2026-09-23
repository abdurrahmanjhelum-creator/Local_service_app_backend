const express = require('express');
const router = express.Router();
const {
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    updateFcmToken
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getUserNotifications);
router.put('/read-all', protect, markAllAsRead);
router.put('/:id/read', protect, markAsRead);
router.delete('/clear', protect, clearNotifications);
router.post('/fcm-token', protect, updateFcmToken);

module.exports = router;
