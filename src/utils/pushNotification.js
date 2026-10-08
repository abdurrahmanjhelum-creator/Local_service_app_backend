const Notification = require('../models/Notification');
const User = require('../models/User');
const firebaseAdmin = require('../config/firebaseAdmin');
const logger = require('../utils/logger');

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
                logger.info('Socket notification sent', { userId, notificationId: notification._id });
            }
        }

        // 3. Dispatch real FCM push notification if user has fcmToken
        try {
            const user = await User.findById(userId).select('fcmToken');
            
            if (!user) {
                logger.warn('User not found for FCM notification', { userId });
                return notification;
            }

            if (!user.fcmToken) {
                logger.warn('User has no FCM token', { userId });
                return notification;
            }

            if (!firebaseAdmin) {
                logger.warn('Firebase Admin not initialized - FCM notifications disabled');
                logger.warn('To enable FCM, add FIREBASE_SERVICE_ACCOUNT_JSON to .env file');
                return notification;
            }

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

            const messageId = await firebaseAdmin.messaging().send(message);
            logger.info('FCM Push Notification sent successfully', { 
                userId, 
                messageId,
                fcmToken: user.fcmToken.substring(0, 20) + '...' 
            });
        } catch (fcmError) {
            logger.error('FCM Push Notification failed', { 
                error: fcmError.message,
                code: fcmError.code,
                userId 
            });
            
            // Handle invalid token - remove from database
            if (fcmError.code === 'messaging/registration-token-not-registered' ||
                fcmError.code === 'messaging/invalid-registration-token') {
                logger.warn('Invalid FCM token, removing from database', { userId });
                await User.findByIdAndUpdate(userId, { fcmToken: '' });
            }
        }

        return notification;
    } catch (error) {
        logger.error('Error sending notification', { error: error.message, userId });
        return null;
    }
};

module.exports = sendNotification;
