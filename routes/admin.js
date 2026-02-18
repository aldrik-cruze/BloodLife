const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { validate, validationRules } = require('../middleware/validator');
const { authLimiter } = require('../middleware/rateLimiter');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '1h';

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

// Admin Login
router.post('/login', authLimiter, validate(validationRules.adminLogin), asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM admins WHERE username = ?';
        db.query(query, [username], async (err, results) => {
            try {
                if (err) {
                    logger.error('Database error during login:', err);
                    return reject(new AppError('Database error', 500));
                }

                if (results.length === 0) {
                    return reject(new AppError('Invalid credentials', 401));
                }

                const admin = results[0];
                const validPassword = await bcrypt.compare(password, admin.password_hash);

                if (!validPassword) {
                    return reject(new AppError('Invalid credentials', 401));
                }

                const token = jwt.sign(
                    { username: admin.username, id: admin.id, role: admin.role, type: 'admin' },
                    JWT_SECRET,
                    { expiresIn: JWT_EXPIRY }
                );

                logger.info(`Admin login successful: ${username}`);
                res.json({
                    success: true,
                    message: 'Login successful',
                    token,
                    user: {
                        id: admin.id,
                        username: admin.username,
                        role: admin.role
                    }
                });
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}));

// Get Analytics
router.get('/analytics', authenticateToken, asyncHandler(async (req, res) => {
    const queries = {
        totalDonors: 'SELECT COUNT(*) as count FROM donors',
        availableDonors: 'SELECT COUNT(*) as count FROM donors WHERE availability = 1',
        totalRequests: 'SELECT COUNT(*) as count FROM blood_requests',
        pendingRequests: 'SELECT COUNT(*) as count FROM blood_requests WHERE status = "Pending"',
        donorsByBloodGroup: 'SELECT blood_group, COUNT(*) as count FROM donors GROUP BY blood_group',
        requestsByBloodGroup: 'SELECT blood_group, COUNT(*) as count FROM blood_requests GROUP BY blood_group',
        requestsByStatus: 'SELECT status, COUNT(*) as count FROM blood_requests GROUP BY status',
        recentDonations: 'SELECT COUNT(*) as count FROM donations WHERE donation_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)'
    };

    const analytics = {};

    for (const [key, query] of Object.entries(queries)) {
        await new Promise((resolve, reject) => {
            db.query(query, (err, results) => {
                if (err) reject(err);
                else {
                    analytics[key] = Array.isArray(results) ? results : [results];
                    resolve();
                }
            });
        });
    }

    res.json({
        success: true,
        data: analytics
    });
}));

// Get all admins (super_admin only)
router.get('/users', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'super_admin') {
        throw new AppError('Access denied. Super admin only.', 403);
    }

    const query = 'SELECT id, username, email, role, created_at FROM admins';
    db.query(query, (err, results) => {
        if (err) throw new AppError('Database error', 500);
        res.json({ success: true, data: results });
    });
}));

// Create new admin (super_admin only)
router.post('/users', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'super_admin') {
        throw new AppError('Access denied. Super admin only.', 403);
    }

    const { username, password, email, role } = req.body;
    
    if (!username || !password) {
        throw new AppError('Username and password are required', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO admins (username, password_hash, email, role) VALUES (?, ?, ?, ?)';
    
    db.query(query, [username, hashedPassword, email || null, role || 'admin'], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                throw new AppError('Username already exists', 400);
            }
            throw new AppError('Database error', 500);
        }

        logger.info(`New admin created: ${username} by ${req.user.username}`);
        res.json({
            success: true,
            message: 'Admin created successfully',
            id: result.insertId
        });
    });
}));

module.exports = router;
