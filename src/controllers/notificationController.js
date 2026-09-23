const Notification = require('../models/Notification');
const User = require('../models/User');

// @desc    Get user notifications and unread count
// @route   GET /api/notifications
// @access  Private
const getUserNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({
            user: req.user._id,
            isRead: false
        });

        res.json({
            notifications,
            unreadCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: 'Notification nahi mili' });
        }

        res.json(notification);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark all user notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user._id, isRead: false },
            { isRead: true }
        );

        res.json({ message: 'Tamam notifications read mark ho gayi hain' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Clear all user notifications
// @route   DELETE /api/notifications/clear
// @access  Private
const clearNotifications = async (req, res) => {
    try {
        await Notification.deleteMany({ user: req.user._id });
        res.json({ message: 'Notification history saaf kar di gayi hai' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Save/Update FCM device token
// @route   POST /api/notifications/fcm-token
// @access  Private
const updateFcmToken = async (req, res) => {
    try {
        const { fcmToken } = req.body;
        if (!fcmToken) {
            return res.status(400).json({ message: 'FCM Token dena zaroori hai' });
        }

        await User.findByIdAndUpdate(req.user._id, { fcmToken });
        res.json({ message: 'FCM Token successfully update ho gaya hai' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    updateFcmToken
};
