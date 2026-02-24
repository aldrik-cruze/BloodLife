const express = require('express');
const router = express.Router();
const db = require('../config/firebase');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { validate, validationRules } = require('../middleware/validator');
const { registerLimiter } = require('../middleware/rateLimiter');
const { isDonorEligible, getDaysUntilEligible, getCompatibleBloodGroups } = require('../utils/bloodCompatibility');
const notificationService = require('../utils/notificationService');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return next(new AppError('Authentication required', 401));
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        next(new AppError('Invalid or expired token', 403));
    }
}

// Get all donors with pagination
router.get('/', validate(validationRules.pagination), asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const bloodGroup = req.query.blood_group;
    const availability = req.query.availability;
    const location = req.query.location;

    let ref = db.collection('donors');
    if (bloodGroup) ref = ref.where('blood_group', '==', bloodGroup);
    if (availability !== undefined) ref = ref.where('availability', '==', parseInt(availability));

    const countSnap = await ref.count().get();
    const total = countSnap.data().count;

    const snap = await ref.orderBy('created_at', 'desc').limit(limit).offset(offset).get();
    let results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Client-side filter for location (Firestore doesn't support LIKE)
    if (location) {
        results = results.filter(d => d.address && d.address.toLowerCase().includes(location.toLowerCase()));
    }

    res.json({
        success: true,
        data: results,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
}));

// Get donor by ID
router.get('/:id', validate(validationRules.idParam), asyncHandler(async (req, res) => {
    const doc = await db.collection('donors').doc(req.params.id).get();
    if (!doc.exists) throw new AppError('Donor not found', 404);
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}));

// Get donor eligibility
router.get('/:id/eligibility', validate(validationRules.idParam), asyncHandler(async (req, res) => {
    const doc = await db.collection('donors').doc(req.params.id).get();
    if (!doc.exists) throw new AppError('Donor not found', 404);

    const { last_donation_date } = doc.data();
    const eligible = isDonorEligible(last_donation_date);
    const daysUntilEligible = getDaysUntilEligible(last_donation_date);

    res.json({
        success: true,
        data: {
            eligible,
            last_donation_date,
            days_until_eligible: daysUntilEligible,
            message: eligible ? 'Eligible to donate' : `Not eligible. Can donate after ${daysUntilEligible} days`
        }
    });
}));

// Get compatible donors for a blood group
router.get('/compatible/:bloodGroup', asyncHandler(async (req, res) => {
    const { bloodGroup } = req.params;
    const compatibleGroups = getCompatibleBloodGroups(bloodGroup);
    if (compatibleGroups.length === 0) throw new AppError('Invalid blood group', 400);

    const snap = await db.collection('donors')
        .where('blood_group', 'in', compatibleGroups)
        .where('availability', '==', 1)
        .orderBy('created_at', 'desc')
        .get();

    res.json({
        success: true,
        blood_group: bloodGroup,
        compatible_groups: compatibleGroups,
        data: snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    });
}));

// Register new donor
router.post('/register', registerLimiter, validate(validationRules.donorRegister), asyncHandler(async (req, res) => {
    const { fullname, age, gender, blood_group, phone, email, address, last_donation_date, availability } = req.body;

    // Check duplicate email
    const existing = await db.collection('donors').where('email', '==', email).limit(1).get();
    if (!existing.empty) throw new AppError('Email already registered', 400);

    const ref = await db.collection('donors').add({
        fullname,
        age: parseInt(age),
        gender,
        blood_group,
        phone,
        email,
        address,
        last_donation_date: last_donation_date || null,
        availability: availability !== undefined ? availability : 1,
        profile_picture: null,
        created_at: new Date()
    });

    logger.info(`New donor registered: ${email}`);
    notificationService.sendWelcomeEmail(email, fullname).catch(e => logger.error('Welcome email failed:', e));

    res.json({ success: true, message: 'Donor registered successfully', id: ref.id });
}));

// Update donor
router.put('/:id', authenticateToken, validate(validationRules.donorUpdate), asyncHandler(async (req, res) => {
    const { fullname, age, gender, blood_group, phone, email, address, last_donation_date, availability } = req.body;
    const ref = db.collection('donors').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) throw new AppError('Donor not found', 404);

    // Check duplicate email (exclude self)
    if (email && email !== doc.data().email) {
        const existing = await db.collection('donors').where('email', '==', email).limit(1).get();
        if (!existing.empty) throw new AppError('Email already exists', 400);
    }

    await ref.update({ fullname, age: parseInt(age), gender, blood_group, phone, email, address, last_donation_date: last_donation_date || null, availability, updated_at: new Date() });

    logger.info(`Donor updated: ID ${req.params.id}`);
    res.json({ success: true, message: 'Donor updated successfully' });
}));

// Update donor availability
router.patch('/:id/availability', authenticateToken, validate(validationRules.idParam), asyncHandler(async (req, res) => {
    const { availability } = req.body;
    if (typeof availability !== 'boolean' && typeof availability !== 'number') {
        throw new AppError('Availability must be boolean or number (0/1)', 400);
    }

    const ref = db.collection('donors').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) throw new AppError('Donor not found', 404);

    await ref.update({ availability, updated_at: new Date() });
    logger.info(`Donor availability updated: ID ${req.params.id}`);
    res.json({ success: true, message: 'Availability updated' });
}));

// Delete donor
router.delete('/:id', authenticateToken, validate(validationRules.idParam), asyncHandler(async (req, res) => {
    const ref = db.collection('donors').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) throw new AppError('Donor not found', 404);

    await ref.delete();
    logger.info(`Donor deleted: ID ${req.params.id}`);
    res.json({ success: true, message: 'Donor deleted successfully' });
}));

module.exports = router;
