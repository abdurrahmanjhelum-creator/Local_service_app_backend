const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Send Notification Helper
 * 1. Saves notification history to MongoDB
 * 2. Emits real-time Socket.io event to user room
 * 3. Gracefully attempts FCM push if user has an fcmToken
 */
const sendNotification = async ({ app, userId, title, body, type = 'general', data = {} }) => {
    try {
        if (!userId) return null;

        // 1. Save to MongoDB Notification history
        const notification = await Notification.create({
            user: userId,
            title,
            body,
            type,
            data
        });

        // 2. Emit Socket.io real-time event to user private room
        if (app) {
            const io = app.get('io');
            if (io) {
                io.to(userId.toString()).emit('notification_received', notification);
            }
        }

        // 3. Optional FCM push notification
        try {
            const user = await User.findById(userId).select('fcmToken');
            if (user && user.fcmToken) {
                console.log(`📱 Push notification logged for user ${userId}`);
            }
        } catch (fcmError) {
            console.error('FCM Push Notification error:', fcmError.message);
        }

        return notification;
    } catch (error) {
        console.error('Error sending notification:', error.message);
        return null;
    }
};

module.exports = sendNotification;
