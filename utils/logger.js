const winston = require('winston');
const path = require('path');

const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white'
};

winston.addColors(logColors);

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`)
);

const transports = [
    new winston.transports.Console({
        format: consoleFormat
    }),
    new winston.transports.File({
        filename: path.join(__dirname, '../logs/error.log'),
        level: 'error',
        format: logFormat
    }),
    new winston.transports.File({
        filename: path.join(__dirname, '../logs/combined.log'),
        format: logFormat
    })
];

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    levels: logLevels,
    transports
});

module.exports = logger;
