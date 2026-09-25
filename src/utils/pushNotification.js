const Notification = require('../models/Notification');
const User = require('../models/User');
const firebaseAdmin = require('../config/firebaseAdmin');

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
                const payload = notification.toObject();
                payload._id = notification._id.toString();
                payload.user = notification.user.toString();
                io.to(userId.toString()).emit('notification_received', payload);
            }
        }

        // 3. Dispatch real FCM push notification if user has fcmToken
        try {
            const user = await User.findById(userId).select('fcmToken');
            if (user && user.fcmToken && firebaseAdmin) {
                const message = {
                    token: user.fcmToken,
                    notification: { title, body },
                    data: {
                        type: String(type || 'general'),
                        title: String(title || ''),
                        body: String(body || ''),
                        bookingId: data.bookingId ? data.bookingId.toString() : '',
                        status: data.status ? data.status.toString() : '',
                        click_action: 'FLUTTER_NOTIFICATION_CLICK'
                    },
                    android: {
                        priority: 'high',
                        notification: {
                            channelId: 'local_services_high_importance_v3',
                            sound: 'default'
                        }
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: 'default',
                                badge: 1
                            }
                        }
                    }
                };
                await firebaseAdmin.messaging().send(message);
                console.log(`📱 Real FCM Push Notification sent to user ${userId}`);
            }
        } catch (fcmError) {
            console.warn('⚠️ FCM Push Notification notice:', fcmError.message);
        }

        return notification;
    } catch (error) {
        console.error('Error sending notification:', error.message);
        return null;
    }
};

module.exports = sendNotification;
