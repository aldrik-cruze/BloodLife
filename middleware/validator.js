const { body, param, query, validationResult } = require('express-validator');

const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        const extractedErrors = errors.array().map(err => ({
            field: err.path,
            message: err.msg
        }));

        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: extractedErrors
        });
    };
};

// Password validation rules
const passwordRules = () => body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[@$!%*?&#]/).withMessage('Password must contain at least one special character (@$!%*?&#)');

// Common validation rules
const validationRules = {
    adminLogin: [
        body('username').trim().notEmpty().withMessage('Username is required'),
        body('password').notEmpty().withMessage('Password is required')
    ],

    adminPasswordReset: [
        body('email').isEmail().withMessage('Valid email is required'),
        passwordRules()
    ],

    donorRegister: [
        body('fullname').trim().isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters'),
        body('age').isInt({ min: 18, max: 65 }).withMessage('Age must be between 18 and 65'),
        body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female, or Other'),
        body('blood_group').isIn(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).withMessage('Invalid blood group'),
        body('phone').matches(/^[\d\s\+\-\(\)]+$/).withMessage('Invalid phone number format'),
        body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
        body('address').trim().isLength({ min: 5, max: 500 }).withMessage('Address must be 5-500 characters'),
        body('last_donation_date').optional({ nullable: true }).isISO8601().withMessage('Invalid date format'),
        body('availability').optional().isBoolean().withMessage('Availability must be boolean')
    ],

    donorUpdate: [
        param('id').isInt().withMessage('Invalid donor ID'),
        body('fullname').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters'),
        body('age').optional().isInt({ min: 18, max: 65 }).withMessage('Age must be between 18 and 65'),
        body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female, or Other'),
        body('blood_group').optional().isIn(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).withMessage('Invalid blood group'),
        body('phone').optional().matches(/^[\d\s\+\-\(\)]+$/).withMessage('Invalid phone number format'),
        body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
        body('address').optional().trim().isLength({ min: 5, max: 500 }).withMessage('Address must be 5-500 characters'),
        body('last_donation_date').optional({ nullable: true }).isISO8601().withMessage('Invalid date format'),
        body('availability').optional().isBoolean().withMessage('Availability must be boolean')
    ],

    bloodRequest: [
        body('patient_name').trim().isLength({ min: 2, max: 100 }).withMessage('Patient name must be 2-100 characters'),
        body('blood_group').isIn(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).withMessage('Invalid blood group'),
        body('units').isInt({ min: 1, max: 20 }).withMessage('Units must be between 1 and 20'),
        body('hospital').trim().isLength({ min: 2, max: 150 }).withMessage('Hospital name must be 2-150 characters'),
        body('phone').matches(/^[\d\s\+\-\(\)]+$/).withMessage('Invalid phone number format'),
        body('needed_date').isISO8601().withMessage('Invalid date format'),
        body('is_emergency').optional().isBoolean().withMessage('is_emergency must be boolean')
    ],

    requestStatusUpdate: [
        param('id').isInt().withMessage('Invalid request ID'),
        body('status').isIn(['Pending', 'Approved', 'Rejected', 'Fulfilled']).withMessage('Invalid status')
    ],

    pagination: [
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    ],

    idParam: [
        param('id').isInt().withMessage('Invalid ID')
    ]
};

module.exports = {
    validate,
    validationRules,
    passwordRules
};
