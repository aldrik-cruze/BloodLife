const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/firebase');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { validate, validationRules, passwordRules } = require('../middleware/validator');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { body } = require('express-validator');
const { uploadProfilePicture } = require('../utils/upload');
const notificationService = require('../utils/notificationService');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

function authenticateDonor(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return next(new AppError('Authentication required', 401));
    try {
        const user = jwt.verify(token, JWT_SECRET);
        if (user.type !== 'donor') return next(new AppError('Donor access only', 403));
        req.user = user;
        next();
    } catch (err) {
        next(new AppError('Invalid or expired token', 403));
    }
}

// Donor Registration (create account)
router.post('/register', registerLimiter, validate([
    body('donor_id').notEmpty().withMessage('Valid donor ID required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    passwordRules()
]), asyncHandler(async (req, res) => {
    const { donor_id, email, password } = req.body;

    const donorDoc = await db.collection('donors').doc(donor_id).get();
    if (!donorDoc.exists || donorDoc.data().email !== email) {
        throw new AppError('Donor not found. Please register as donor first.', 404);
    }

    const existingSnap = await db.collection('donor_accounts')
        .where('donor_id', '==', donor_id).limit(1).get();
    if (!existingSnap.empty) throw new AppError('Account already exists', 400);

    const existingEmailSnap = await db.collection('donor_accounts')
        .where('email', '==', email).limit(1).get();
    if (!existingEmailSnap.empty) throw new AppError('Account already exists', 400);

    const hashedPassword = await bcrypt.hash(password, 10);
    const ref = await db.collection('donor_accounts').add({
        donor_id,
        email,
        password_hash: hashedPassword,
        is_verified: 0,
        last_login: null,
        created_at: new Date()
    });

    logger.info(`Donor account created: ${email}`);
    notificationService.sendWelcomeEmail(email, donorDoc.data().fullname || 'Donor')
        .catch(e => logger.warn('Welcome email failed: ' + e.message));

    res.json({ success: true, message: 'Account created successfully. Please login.', id: ref.id });
}));

// Donor Login
router.post('/login', authLimiter, validate([
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required')
]), asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const accountSnap = await db.collection('donor_accounts').where('email', '==', email).limit(1).get();
    if (accountSnap.empty) throw new AppError('Invalid credentials', 401);

    const accountDoc = accountSnap.docs[0];
    const account = { id: accountDoc.id, ...accountDoc.data() };

    const validPassword = await bcrypt.compare(password, account.password_hash);
    if (!validPassword) throw new AppError('Invalid credentials', 401);

    const donorDoc = await db.collection('donors').doc(account.donor_id).get();
    const donor = donorDoc.data();

    const token = jwt.sign(
        { id: account.id, donor_id: account.donor_id, email: account.email, type: 'donor' },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );

    db.collection('donor_accounts').doc(account.id).update({ last_login: new Date() }).catch(() => {});

    logger.info(`Donor login: ${email}`);
    res.json({
        success: true,
        message: 'Login successful',
        token,
        donor: { id: account.donor_id, name: donor.fullname, blood_group: donor.blood_group }
    });
}));

// Get Donor Profile
router.get('/profile', authenticateDonor, asyncHandler(async (req, res) => {
    const donorDoc = await db.collection('donors').doc(req.user.donor_id).get();
    if (!donorDoc.exists) throw new AppError('Profile not found', 404);

    const accountSnap = await db.collection('donor_accounts')
        .where('donor_id', '==', req.user.donor_id).limit(1).get();

    const donorData = donorDoc.data();
    const accountData = accountSnap.empty ? {} : accountSnap.docs[0].data();

    res.json({
        success: true,
        data: {
            id: donorDoc.id,
            ...donorData,
            account_email: accountData.email,
            last_login: accountData.last_login
        }
    });
}));

// Update Donor Profile
router.put('/profile', authenticateDonor, validate([
    body('fullname').optional().trim().isLength({ min: 2, max: 100 }),
    body('age').optional().isInt({ min: 18, max: 65 }),
    body('gender').optional().isIn(['Male', 'Female', 'Other']),
    body('phone').optional().matches(/^[\d\s\+\-\(\)]+$/),
    body('address').optional().trim().isLength({ min: 5, max: 500 }),
    body('availability').optional().isBoolean()
]), asyncHandler(async (req, res) => {
    const { fullname, age, gender, phone, address, availability } = req.body;

    const updates = {};
    if (fullname !== undefined) updates.fullname = fullname;
    if (age !== undefined) updates.age = parseInt(age);
    if (gender !== undefined) updates.gender = gender;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (availability !== undefined) updates.availability = availability;

    if (Object.keys(updates).length === 0) throw new AppError('No fields to update', 400);

    updates.updated_at = new Date();
    await db.collection('donors').doc(req.user.donor_id).update(updates);

    logger.info(`Donor profile updated: ID ${req.user.donor_id}`);
    res.json({ success: true, message: 'Profile updated successfully' });
}));

// Get Donation History
router.get('/donations', authenticateDonor, asyncHandler(async (req, res) => {
    const snap = await db.collection('donations')
        .where('donor_id', '==', req.user.donor_id)
        .orderBy('donation_date', 'desc')
        .get();

    res.json({
        success: true,
        data: snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    });
}));

// Upload Profile Picture
router.post('/profile/picture', authenticateDonor, (req, res, next) => {
    uploadProfilePicture(req, res, (err) => {
        if (err) return next(err);
        next();
    });
}, asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('No image file provided', 400);

    const profilePicturePath = req.file.path;
    await db.collection('donors').doc(req.user.donor_id).update({
        profile_picture: profilePicturePath,
        updated_at: new Date()
    });

    logger.info(`Profile picture updated: donor ID ${req.user.donor_id}`);
    res.json({
        success: true,
        message: 'Profile picture updated successfully',
        profile_picture: profilePicturePath
    });
}));

// Get Eligibility Status
router.get('/eligibility', authenticateDonor, asyncHandler(async (req, res) => {
    const { isDonorEligible, getDaysUntilEligible } = require('../utils/bloodCompatibility');

    const doc = await db.collection('donors').doc(req.user.donor_id).get();
    if (!doc.exists) throw new AppError('Donor not found', 404);

    const { last_donation_date } = doc.data();
    const eligible = isDonorEligible(last_donation_date);
    const daysUntil = getDaysUntilEligible(last_donation_date);

    res.json({
        success: true,
        data: {
            eligible,
            last_donation_date,
            days_until_eligible: daysUntil,
            next_donation_date: last_donation_date ?
                new Date(new Date(last_donation_date).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] :
                null
        }
    });
}));

module.exports = router;
