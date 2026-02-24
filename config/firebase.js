const admin = require('firebase-admin');
const logger = require('../utils/logger');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    logger.error('Missing required environment variable: FIREBASE_SERVICE_ACCOUNT');
    process.exit(1);
}

let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
    logger.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function initFirestore() {
    logger.info('Initializing Firestore...');
    try {
        const snap = await db.collection('admins')
            .where('username', '==', process.env.DEFAULT_ADMIN_USERNAME || 'admin')
            .limit(1).get();

        if (snap.empty) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@12345', 10);
            await db.collection('admins').add({
                username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
                password_hash: hashedPassword,
                role: 'super_admin',
                email: null,
                created_at: new Date()
            });
            logger.info('Default admin created in Firestore.');
        } else {
            logger.info('Firestore initialized. Admin already exists.');
        }
    } catch (err) {
        logger.error('Firestore initialization error:', err);
    }
}

initFirestore();

module.exports = db;
