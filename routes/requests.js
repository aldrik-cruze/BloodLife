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

    if (!token) throw new AppError('Authentication required', 401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) throw new AppError('Invalid or expired token', 403);
        req.user = user;
        next();
    });
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

    db.query(countQuery, countParams, (err, countResults) => {
        if (err) throw new AppError('Database error', 500);

        const total = countResults[0].total;

        db.query(query, params, (err, results) => {
            if (err) throw new AppError('Database error', 500);

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
        });
    });
}));

// Get request by ID
router.get('/:id', validate(validationRules.idParam), asyncHandler(async (req, res) => {
    const query = 'SELECT * FROM blood_requests WHERE id = ?';
    db.query(query, [req.params.id], (err, results) => {
        if (err) throw new AppError('Database error', 500);
        if (results.length === 0) throw new AppError('Request not found', 404);
        res.json({ success: true, data: results[0] });
    });
}));

// Create blood request
router.post('/', registerLimiter, validate(validationRules.bloodRequest), asyncHandler(async (req, res) => {
    const { patient_name, blood_group, units, hospital, phone, needed_date, is_emergency } = req.body;
    
    const query = 'INSERT INTO blood_requests (patient_name, blood_group, units, hospital, phone, needed_date, is_emergency) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const isEmergency = is_emergency || 0;

    db.query(query, [patient_name, blood_group, units, hospital, phone, needed_date, isEmergency], async (err, result) => {
        if (err) throw new AppError('Error creating request', 500);

        logger.info(`New blood request created: ${blood_group} at ${hospital}`);

        // Find compatible donors and notify them (async)
        const compatibleGroups = getCompatibleBloodGroups(blood_group);
        if (compatibleGroups.length > 0) {
            const placeholders = compatibleGroups.map(() => '?').join(',');
            const donorQuery = `SELECT email, fullname FROM donors WHERE blood_group IN (${placeholders}) AND availability = 1`;

            db.query(donorQuery, compatibleGroups, async (err, donors) => {
                if (!err && donors.length > 0) {
                    const requestDetails = {
                        patient_name,
                        blood_group,
                        units,
                        hospital,
                        phone,
                        needed_date
                    };

                    // Send notifications to all compatible donors (don't wait)
                    donors.forEach(donor => {
                        notificationService.notifyDonorMatch(donor.email, donor.fullname, requestDetails)
                            .catch(e => logger.error(`Notification failed for ${donor.email}:`, e));
                    });

                    logger.info(`Notified ${donors.length} compatible donors for request ID ${result.insertId}`);
                }
            });
        }

        res.json({
            success: true,
            message: 'Request created successfully',
            id: result.insertId
        });
    });
}));

// Update request status
router.put('/:id/status', authenticateToken, validate(validationRules.requestStatusUpdate), asyncHandler(async (req, res) => {
    const { status } = req.body;
    const requestId = req.params.id;

    // Get request details first
    const getQuery = 'SELECT * FROM blood_requests WHERE id = ?';
    db.query(getQuery, [requestId], (err, results) => {
        if (err) throw new AppError('Database error', 500);
        if (results.length === 0) throw new AppError('Request not found', 404);

        const request = results[0];

        // Update status
        const updateQuery = 'UPDATE blood_requests SET status = ? WHERE id = ?';
        db.query(updateQuery, [status, requestId], async (err, result) => {
            if (err) throw new AppError('Database error', 500);

            logger.info(`Request ${requestId} status updated to ${status}`);

            // Send notification about status change (if email available in phone field or separate field)
            if (['Approved', 'Fulfilled', 'Rejected'].includes(status)) {
                // This would require storing requester email, which we can add
                // For now, just log it
                logger.info(`Would notify requester about status: ${status}`);
            }

            res.json({
                success: true,
                message: 'Request status updated',
                status
            });
        });
    });
}));

// Delete request
router.delete('/:id', authenticateToken, validate(validationRules.idParam), asyncHandler(async (req, res) => {
    const query = 'DELETE FROM blood_requests WHERE id=?';
    
    db.query(query, [req.params.id], (err, result) => {
        if (err) throw new AppError('Database error', 500);
        if (result.affectedRows === 0) throw new AppError('Request not found', 404);

        logger.info(`Request deleted: ID ${req.params.id}`);
        res.json({ success: true, message: 'Request deleted successfully' });
    });
}));

module.exports = router;
