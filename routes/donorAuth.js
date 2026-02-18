const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { validate, validationRules, passwordRules } = require('../middleware/validator');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { body } = require('express-validator');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Auth Middleware for donors
function authenticateDonor(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) throw new AppError('Authentication required', 401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) throw new AppError('Invalid or expired token', 403);
        if (user.type !== 'donor') throw new AppError('Donor access only', 403);
        req.user = user;
        next();
    });
}

// Donor Registration (create account)
router.post('/register', registerLimiter, validate([
    body('donor_id').isInt().withMessage('Valid donor ID required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    passwordRules()
]), asyncHandler(async (req, res) => {
    const { donor_id, email, password } = req.body;

    // Check if donor exists
    const donorQuery = 'SELECT id, email FROM donors WHERE id = ? AND email = ?';
    db.query(donorQuery, [donor_id, email], async (err, donors) => {
        if (err) throw new AppError('Database error', 500);
        if (donors.length === 0) throw new AppError('Donor not found. Please register as donor first.', 404);

        // Check if account already exists
        const accountQuery = 'SELECT id FROM donor_accounts WHERE donor_id = ? OR email = ?';
        db.query(accountQuery, [donor_id, email], async (err, accounts) => {
            if (err) throw new AppError('Database error', 500);
            if (accounts.length > 0) throw new AppError('Account already exists', 400);

            // Create account
            const hashedPassword = await bcrypt.hash(password, 10);
            const insertQuery = 'INSERT INTO donor_accounts (donor_id, email, password_hash) VALUES (?, ?, ?)';
            
            db.query(insertQuery, [donor_id, email, hashedPassword], (err, result) => {
                if (err) throw new AppError('Error creating account', 500);

                logger.info(`Donor account created: ${email}`);
                res.json({
                    success: true,
                    message: 'Account created successfully. Please login.',
                    id: result.insertId
                });
            });
        });
    });
}));

// Donor Login
router.post('/login', authLimiter, validate([
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required')
]), asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const query = `
        SELECT da.*, d.fullname, d.blood_group 
        FROM donor_accounts da
        JOIN donors d ON da.donor_id = d.id
        WHERE da.email = ?
    `;

    db.query(query, [email], async (err, results) => {
        if (err) throw new AppError('Database error', 500);
        if (results.length === 0) throw new AppError('Invalid credentials', 401);

        const account = results[0];
        const validPassword = await bcrypt.compare(password, account.password_hash);

        if (!validPassword) throw new AppError('Invalid credentials', 401);

        const token = jwt.sign(
            { 
                id: account.id,
                donor_id: account.donor_id,
                email: account.email,
                type: 'donor'
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        // Update last login
        db.query('UPDATE donor_accounts SET last_login = NOW() WHERE id = ?', [account.id]);

        logger.info(`Donor login: ${email}`);
        res.json({
            success: true,
            message: 'Login successful',
            token,
            donor: {
                id: account.donor_id,
                name: account.fullname,
                blood_group: account.blood_group
            }
        });
    });
}));

// Get Donor Profile
router.get('/profile', authenticateDonor, asyncHandler(async (req, res) => {
    const query = `
        SELECT d.*, da.email as account_email, da.last_login
        FROM donors d
        JOIN donor_accounts da ON d.id = da.donor_id
        WHERE d.id = ?
    `;

    db.query(query, [req.user.donor_id], (err, results) => {
        if (err) throw new AppError('Database error', 500);
        if (results.length === 0) throw new AppError('Profile not found', 404);

        res.json({
            success: true,
            data: results[0]
        });
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
    
    const updates = [];
    const values = [];

    if (fullname) { updates.push('fullname = ?'); values.push(fullname); }
    if (age) { updates.push('age = ?'); values.push(age); }
    if (gender) { updates.push('gender = ?'); values.push(gender); }
    if (phone) { updates.push('phone = ?'); values.push(phone); }
    if (address) { updates.push('address = ?'); values.push(address); }
    if (availability !== undefined) { updates.push('availability = ?'); values.push(availability); }

    if (updates.length === 0) {
        throw new AppError('No fields to update', 400);
    }

    values.push(req.user.donor_id);
    const query = `UPDATE donors SET ${updates.join(', ')} WHERE id = ?`;

    db.query(query, values, (err, result) => {
        if (err) throw new AppError('Database error', 500);

        logger.info(`Donor profile updated: ID ${req.user.donor_id}`);
        res.json({
            success: true,
            message: 'Profile updated successfully'
        });
    });
}));

// Get Donation History
router.get('/donations', authenticateDonor, asyncHandler(async (req, res) => {
    const query = `
        SELECT * FROM donations 
        WHERE donor_id = ? 
        ORDER BY donation_date DESC
    `;

    db.query(query, [req.user.donor_id], (err, results) => {
        if (err) throw new AppError('Database error', 500);

        res.json({
            success: true,
            data: results
        });
    });
}));

// Get Eligibility Status
router.get('/eligibility', authenticateDonor, asyncHandler(async (req, res) => {
    const { isDonorEligible, getDaysUntilEligible } = require('../utils/bloodCompatibility');
    
    const query = 'SELECT last_donation_date FROM donors WHERE id = ?';
    db.query(query, [req.user.donor_id], (err, results) => {
        if (err) throw new AppError('Database error', 500);

        const { last_donation_date } = results[0];
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
    });
}));

module.exports = router;
