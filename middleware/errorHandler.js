const logger = require('../utils/logger');

class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        logger.error(`Error: ${err.message}`, { 
            error: err, 
            stack: err.stack,
            url: req.originalUrl,
            method: req.method
        });
        
        res.status(err.statusCode).json({
            success: false,
            status: err.status,
            message: err.message,
            stack: err.stack,
            error: err
        });
    } else {
        logger.error(`Error: ${err.message}`, { 
            url: req.originalUrl,
            method: req.method
        });

        if (err.isOperational) {
            res.status(err.statusCode).json({
                success: false,
                status: err.status,
                message: err.message
            });
        } else {
            res.status(500).json({
                success: false,
                status: 'error',
                message: 'Something went wrong!'
            });
        }
    }
};

const notFoundHandler = (req, res, next) => {
    const err = new AppError(`Route ${req.originalUrl} not found`, 404);
    next(err);
};

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    AppError,
    errorHandler,
    notFoundHandler,
    asyncHandler
};
