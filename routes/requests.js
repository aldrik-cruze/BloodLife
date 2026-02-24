const express = require('express');
const router = express.Router();
const db = require('../config/firebase');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { validate, validationRules } = require('../middleware/validator');
const { registerLimiter } = require('../middleware/rateLimiter');
const notificationService = require('../utils/notificationService');
const { getCompatibleBloodGroups } = require('../utils/bloodCompatibility');
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

// Get all requests with pagination
router.get('/', validate(validationRules.pagination), asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const bloodGroup = req.query.blood_group;
    const emergency = req.query.emergency;

    let ref = db.collection('blood_requests');
    if (status) ref = ref.where('status', '==', status);
    if (bloodGroup) ref = ref.where('blood_group', '==', bloodGroup);
    if (emergency !== undefined) ref = ref.where('is_emergency', '==', parseInt(emergency));

    const countSnap = await ref.count().get();
    const total = countSnap.data().count;

    const snap = await ref.orderBy('is_emergency', 'desc').orderBy('created_at', 'desc').limit(limit).offset(offset).get();

    res.json({
        success: true,
        data: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
}));

// Get request by ID
router.get('/:id', validate(validationRules.idParam), asyncHandler(async (req, res) => {
    const doc = await db.collection('blood_requests').doc(req.params.id).get();
    if (!doc.exists) throw new AppError('Request not found', 404);
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}));

// Create blood request
router.post('/', registerLimiter, validate(validationRules.bloodRequest), asyncHandler(async (req, res) => {
    const { patient_name, blood_group, units, hospital, phone, needed_date, is_emergency } = req.body;
    const isEmergency = is_emergency ? 1 : 0;

    const ref = await db.collection('blood_requests').add({
        patient_name,
        blood_group,
        units: parseInt(units),
        hospital,
        phone,
        needed_date,
        is_emergency: isEmergency,
        status: 'Pending',
        created_at: new Date()
    });

    logger.info(`New blood request created: ${blood_group} at ${hospital}`);

    // Notify compatible donors (async)
    const compatibleGroups = getCompatibleBloodGroups(blood_group);
    if (compatibleGroups.length > 0) {
        db.collection('donors')
            .where('blood_group', 'in', compatibleGroups)
            .where('availability', '==', 1)
            .get()
            .then(async donorSnap => {
                const donorIds = donorSnap.docs.map(d => d.id);
                if (donorIds.length === 0) return;

                // Only notify donors with accounts
                const accountSnaps = await Promise.all(
                    donorIds.map(id => db.collection('donor_accounts').where('donor_id', '==', id).limit(1).get())
                );

                const requestDetails = { patient_name, blood_group, units, hospital, phone, needed_date, is_emergency: isEmergency };
                let notified = 0;

                accountSnaps.forEach((snap, i) => {
                    if (!snap.empty) {
                        const donor = donorSnap.docs[i].data();
                        notificationService.notifyDonorMatch(donor.email, donor.fullname, requestDetails)
                            .catch(e => logger.error(`Notification failed for ${donor.email}: ${e.message}`));
                        notified++;
                    }
                });

                logger.info(`Notified ${notified} registered donors for request ID ${ref.id}`);
            })
            .catch(e => logger.error('Donor query failed for notifications:', e.message));
    }

    res.json({ success: true, message: 'Request created successfully', id: ref.id });
}));

// Update request status
router.put('/:id/status', authenticateToken, validate(validationRules.requestStatusUpdate), asyncHandler(async (req, res) => {
    const { status } = req.body;
    const docRef = db.collection('blood_requests').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) throw new AppError('Request not found', 404);

    await docRef.update({ status, updated_at: new Date() });
    logger.info(`Request ${req.params.id} status updated to ${status}`);

    res.json({ success: true, message: 'Request status updated', status });
}));

// Delete request
router.delete('/:id', authenticateToken, validate(validationRules.idParam), asyncHandler(async (req, res) => {
    const docRef = db.collection('blood_requests').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) throw new AppError('Request not found', 404);

    await docRef.delete();
    logger.info(`Request deleted: ID ${req.params.id}`);
    res.json({ success: true, message: 'Request deleted successfully' });
}));

module.exports = router;
