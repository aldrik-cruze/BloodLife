const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { validate, validationRules } = require('../middleware/validator');
const { registerLimiter } = require('../middleware/rateLimiter');
const notificationService = require('../utils/notificationService');
const { getCompatibleBloodGroups } = require('../utils/bloodCompatibility');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Auth Middleware
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

    let query = 'SELECT * FROM blood_requests WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM blood_requests WHERE 1=1';
    const params = [];
    const countParams = [];

    if (status) {
        query += ' AND status = ?';
        countQuery += ' AND status = ?';
        params.push(status);
        countParams.push(status);
    }

    if (bloodGroup) {
        query += ' AND blood_group = ?';
        countQuery += ' AND blood_group = ?';
        params.push(bloodGroup);
        countParams.push(bloodGroup);
    }

    if (emergency !== undefined) {
        query += ' AND is_emergency = ?';
        countQuery += ' AND is_emergency = ?';
        params.push(emergency);
        countParams.push(emergency);
    }

    query += ' ORDER BY is_emergency DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [countResults] = await db.query(countQuery, countParams);
    const total = countResults[0].total;
    const [results] = await db.query(query, params);

    res.json({
        success: true,
        data: results,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
}));

// Get request by ID
router.get('/:id', validate(validationRules.idParam), asyncHandler(async (req, res) => {
    const [results] = await db.query('SELECT * FROM blood_requests WHERE id = ?', [req.params.id]);
    if (results.length === 0) throw new AppError('Request not found', 404);
    res.json({ success: true, data: results[0] });
}));

// Create blood request
router.post('/', registerLimiter, validate(validationRules.bloodRequest), asyncHandler(async (req, res) => {
    const { patient_name, blood_group, units, hospital, phone, needed_date, is_emergency } = req.body;
    
    const query = 'INSERT INTO blood_requests (patient_name, blood_group, units, hospital, phone, needed_date, is_emergency) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const isEmergency = is_emergency || 0;

    const [result] = await db.query(query, [patient_name, blood_group, units, hospital, phone, needed_date, isEmergency]);

    logger.info(`New blood request created: ${blood_group} at ${hospital}`);

    // Find compatible donors and notify them (async, don't block response)
    const compatibleGroups = getCompatibleBloodGroups(blood_group);
    if (compatibleGroups.length > 0) {
        const placeholders = compatibleGroups.map(() => '?').join(',');
        const donorQuery = `
            SELECT d.email, d.fullname FROM donors d
            INNER JOIN donor_accounts da ON da.donor_id = d.id
            WHERE d.blood_group IN (${placeholders}) AND d.availability = 1`;

        db.query(donorQuery, compatibleGroups).then(([donors]) => {
            if (donors.length === 0) {
                logger.info(`No registered donors found for blood group ${blood_group}`);
                return;
            }
            const requestDetails = { patient_name, blood_group, units, hospital, phone, needed_date, is_emergency: isEmergency };
            donors.forEach(donor => {
                notificationService.notifyDonorMatch(donor.email, donor.fullname, requestDetails)
                    .catch(e => logger.error(`Notification failed for ${donor.email}: ${e.message}`));
            });
            logger.info(`Notified ${donors.length} registered donors for request ID ${result.insertId}`);
        }).catch(e => logger.error('Donor query failed for notifications:', e.message));
    }

    res.json({
        success: true,
        message: 'Request created successfully',
        id: result.insertId
    });
}));

// Update request status
router.put('/:id/status', authenticateToken, validate(validationRules.requestStatusUpdate), asyncHandler(async (req, res) => {
    const { status } = req.body;
    const requestId = req.params.id;

    const [results] = await db.query('SELECT * FROM blood_requests WHERE id = ?', [requestId]);
    if (results.length === 0) throw new AppError('Request not found', 404);

    const [result] = await db.query('UPDATE blood_requests SET status = ? WHERE id = ?', [status, requestId]);

    logger.info(`Request ${requestId} status updated to ${status}`);

    if (['Approved', 'Fulfilled', 'Rejected'].includes(status)) {
        logger.info(`Would notify requester about status: ${status}`);
    }

    res.json({
        success: true,
        message: 'Request status updated',
        status
    });
}));

// Delete request
router.delete('/:id', authenticateToken, validate(validationRules.idParam), asyncHandler(async (req, res) => {
    const [result] = await db.query('DELETE FROM blood_requests WHERE id=?', [req.params.id]);
    if (result.affectedRows === 0) throw new AppError('Request not found', 404);

    logger.info(`Request deleted: ID ${req.params.id}`);
    res.json({ success: true, message: 'Request deleted successfully' });
}));

module.exports = router;
