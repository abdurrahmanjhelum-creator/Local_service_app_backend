const admin = require('firebase-admin');

let firebaseAdmin = null;

try {
    // Check if any app is already initialized
    if (admin.apps && admin.apps.length > 0) {
        firebaseAdmin = admin.app();
        console.log('✅ Firebase Admin SDK using existing app');
    } else {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            firebaseAdmin = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✅ Firebase Admin SDK initialized from ENV');
        } else {
            console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_JSON not set — FCM disabled');
        }
    }
} catch (error) {
    console.warn('⚠️ Firebase Admin SDK initialization notice:', error.message);
}

module.exports = firebaseAdmin;
