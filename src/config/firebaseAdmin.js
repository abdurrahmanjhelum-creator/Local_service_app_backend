const admin = require('firebase-admin');

let firebaseAdmin = null;

try {
    if (!admin.apps.length) {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            firebaseAdmin = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✅ Firebase Admin SDK initialized from ENV');
        } else {
            firebaseAdmin = admin.initializeApp();
            console.log('✅ Firebase Admin SDK initialized with default app');
        }
    } else {
        firebaseAdmin = admin.app();
    }
} catch (error) {
    console.warn('⚠️ Firebase Admin SDK initialization notice:', error.message);
}

module.exports = firebaseAdmin;
