const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { validate, validationRules } = require('../middleware/validator');
const { registerLimiter } = require('../middleware/rateLimiter');
const { isDonorEligible, getDaysUntilEligible, getCompatibleBloodGroups } = require('../utils/bloodCompatibility');
const notificationService = require('../utils/notificationService');
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

// Get all donors with pagination
router.get('/', validate(validationRules.pagination), asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const bloodGroup = req.query.blood_group;
    const availability = req.query.availability;
    const location = req.query.location;

    let query = 'SELECT * FROM donors WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM donors WHERE 1=1';
    const params = [];
    const countParams = [];

    if (bloodGroup) {
        query += ' AND blood_group = ?';
        countQuery += ' AND blood_group = ?';
        params.push(bloodGroup);
        countParams.push(bloodGroup);
    }

    if (availability !== undefined) {
        query += ' AND availability = ?';
        countQuery += ' AND availability = ?';
        params.push(availability);
        countParams.push(availability);
    }

    if (location) {
        query += ' AND address LIKE ?';
        countQuery += ' AND address LIKE ?';
        params.push(`%${location}%`);
        countParams.push(`%${location}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
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

// Get donor by ID
router.get('/:id', validate(validationRules.idParam), asyncHandler(async (req, res) => {
    const [results] = await db.query('SELECT * FROM donors WHERE id = ?', [req.params.id]);
    if (results.length === 0) throw new AppError('Donor not found', 404);
    res.json({ success: true, data: results[0] });
}));

// Get donor eligibility
router.get('/:id/eligibility', validate(validationRules.idParam), asyncHandler(async (req, res) => {
    const [results] = await db.query('SELECT last_donation_date FROM donors WHERE id = ?', [req.params.id]);
    if (results.length === 0) throw new AppError('Donor not found', 404);

    const { last_donation_date } = results[0];
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

    if (compatibleGroups.length === 0) {
        throw new AppError('Invalid blood group', 400);
    }

    const placeholders = compatibleGroups.map(() => '?').join(',');
    const query = `SELECT * FROM donors WHERE blood_group IN (${placeholders}) AND availability = 1 ORDER BY created_at DESC`;

    const [results] = await db.query(query, compatibleGroups);

    res.json({
        success: true,
        blood_group: bloodGroup,
        compatible_groups: compatibleGroups,
        data: results
    });
}));

// Register new donor
router.post('/register', registerLimiter, validate(validationRules.donorRegister), asyncHandler(async (req, res) => {
    const { fullname, age, gender, blood_group, phone, email, address, last_donation_date, availability } = req.body;
    
    const query = 'INSERT INTO donors (fullname, age, gender, blood_group, phone, email, address, last_donation_date, availability) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const isAvailable = availability !== undefined ? availability : 1;

    try {
        const [result] = await db.query(query, [fullname, age, gender, blood_group, phone, email, address, last_donation_date || null, isAvailable]);

        logger.info(`New donor registered: ${email}`);
        notificationService.sendWelcomeEmail(email, fullname).catch(e => logger.error('Welcome email failed:', e));

        res.json({
            success: true,
            message: 'Donor registered successfully',
            id: result.insertId
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') throw new AppError('Email already registered', 400);
        throw new AppError('Error registering donor', 500);
    }
}));

// Update donor
router.put('/:id', authenticateToken, validate(validationRules.donorUpdate), asyncHandler(async (req, res) => {
    const { fullname, age, gender, blood_group, phone, email, address, last_donation_date, availability } = req.body;
    
    const query = 'UPDATE donors SET fullname=?, age=?, gender=?, blood_group=?, phone=?, email=?, address=?, last_donation_date=?, availability=? WHERE id=?';
    
    try {
        const [result] = await db.query(query, [fullname, age, gender, blood_group, phone, email, address, last_donation_date || null, availability, req.params.id]);

        if (result.affectedRows === 0) throw new AppError('Donor not found', 404);

        logger.info(`Donor updated: ID ${req.params.id}`);
        res.json({ success: true, message: 'Donor updated successfully' });
    } catch (err) {
        if (err.isOperational) throw err;
        if (err.code === 'ER_DUP_ENTRY') throw new AppError('Email already exists', 400);
        throw new AppError('Database error', 500);
    }
}));

// Update donor availability
router.patch('/:id/availability', authenticateToken, validate(validationRules.idParam), asyncHandler(async (req, res) => {
    const { availability } = req.body;
    
    if (typeof availability !== 'boolean' && typeof availability !== 'number') {
        throw new AppError('Availability must be boolean or number (0/1)', 400);
    }

    const [result] = await db.query('UPDATE donors SET availability=? WHERE id=?', [availability, req.params.id]);
    if (result.affectedRows === 0) throw new AppError('Donor not found', 404);

    logger.info(`Donor availability updated: ID ${req.params.id}`);
    res.json({ success: true, message: 'Availability updated' });
}));

// Delete donor
router.delete('/:id', authenticateToken, validate(validationRules.idParam), asyncHandler(async (req, res) => {
    const [result] = await db.query('DELETE FROM donors WHERE id=?', [req.params.id]);
    if (result.affectedRows === 0) throw new AppError('Donor not found', 404);

    logger.info(`Donor deleted: ID ${req.params.id}`);
    res.json({ success: true, message: 'Donor deleted successfully' });
}));

module.exports = router;
