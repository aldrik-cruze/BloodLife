const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/firebase');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { validate, validationRules } = require('../middleware/validator');
const { authLimiter } = require('../middleware/rateLimiter');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '1h';

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

// Admin Login
router.post('/login', authLimiter, validate(validationRules.adminLogin), asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    const snap = await db.collection('admins').where('username', '==', username).limit(1).get();
    if (snap.empty) throw new AppError('Invalid credentials', 401);

    const adminDoc = snap.docs[0];
    const admin = { id: adminDoc.id, ...adminDoc.data() };

    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) throw new AppError('Invalid credentials', 401);

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
        user: { id: admin.id, username: admin.username, role: admin.role }
    });
}));

// Get Analytics
router.get('/analytics', authenticateToken, asyncHandler(async (req, res) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const [
        totalDonorsSnap, availableDonorsSnap, totalRequestsSnap, pendingRequestsSnap,
        allDonorsSnap, allRequestsSnap, recentDonationsSnap
    ] = await Promise.all([
        db.collection('donors').count().get(),
        db.collection('donors').where('availability', '==', 1).count().get(),
        db.collection('blood_requests').count().get(),
        db.collection('blood_requests').where('status', '==', 'Pending').count().get(),
        db.collection('donors').get(),
        db.collection('blood_requests').get(),
        db.collection('donations').where('donation_date', '>=', thirtyDaysAgoStr).count().get()
    ]);

    // Group donors by blood_group
    const donorsByBloodGroup = {};
    allDonorsSnap.docs.forEach(doc => {
        const bg = doc.data().blood_group;
        donorsByBloodGroup[bg] = (donorsByBloodGroup[bg] || 0) + 1;
    });

    // Group requests by blood_group and status
    const requestsByBloodGroup = {};
    const requestsByStatus = {};
    allRequestsSnap.docs.forEach(doc => {
        const { blood_group, status } = doc.data();
        requestsByBloodGroup[blood_group] = (requestsByBloodGroup[blood_group] || 0) + 1;
        requestsByStatus[status] = (requestsByStatus[status] || 0) + 1;
    });

    res.json({
        success: true,
        data: {
            totalDonors: [{ count: totalDonorsSnap.data().count }],
            availableDonors: [{ count: availableDonorsSnap.data().count }],
            totalRequests: [{ count: totalRequestsSnap.data().count }],
            pendingRequests: [{ count: pendingRequestsSnap.data().count }],
            donorsByBloodGroup: Object.entries(donorsByBloodGroup).map(([blood_group, count]) => ({ blood_group, count })),
            requestsByBloodGroup: Object.entries(requestsByBloodGroup).map(([blood_group, count]) => ({ blood_group, count })),
            requestsByStatus: Object.entries(requestsByStatus).map(([status, count]) => ({ status, count })),
            recentDonations: [{ count: recentDonationsSnap.data().count }]
        }
    });
}));

// Get all admins (super_admin only)
router.get('/users', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'super_admin') throw new AppError('Access denied. Super admin only.', 403);

    const snap = await db.collection('admins').get();
    const admins = snap.docs.map(doc => {
        const { password_hash, ...data } = doc.data();
        return { id: doc.id, ...data };
    });
    res.json({ success: true, data: admins });
}));

// Create new admin (super_admin only)
router.post('/users', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.role !== 'super_admin') throw new AppError('Access denied. Super admin only.', 403);

    const { username, password, email, role } = req.body;
    if (!username || !password) throw new AppError('Username and password are required', 400);

    // Check duplicate
    const existing = await db.collection('admins').where('username', '==', username).limit(1).get();
    if (!existing.empty) throw new AppError('Username already exists', 400);

    const hashedPassword = await bcrypt.hash(password, 10);
    const ref = await db.collection('admins').add({
        username,
        password_hash: hashedPassword,
        email: email || null,
        role: role || 'admin',
        created_at: new Date()
    });

    logger.info(`New admin created: ${username} by ${req.user.username}`);
    res.json({ success: true, message: 'Admin created successfully', id: ref.id });
}));

module.exports = router;
