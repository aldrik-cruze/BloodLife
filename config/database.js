const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true
};

const DB_NAME = process.env.DB_NAME;

const apiDb = mysql.createPool({
    ...dbConfig,
    database: DB_NAME
});

function initDatabase() {
    logger.info('Initializing database connection...');
    const initDbInfo = mysql.createConnection({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password
    });

    initDbInfo.connect((err) => {
        if (err) {
            logger.error('Error connecting to MySQL server:', err);
            process.exit(1);
        }
        logger.info('Connected to MySQL server for initialization.');

        initDbInfo.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``, (err) => {
            if (err) {
                logger.error('Error creating database:', err);
                initDbInfo.end();
                return;
            }

            initDbInfo.changeUser({ database: DB_NAME }, (err) => {
                if (err) {
                    logger.error('Error switching database:', err);
                    initDbInfo.end();
                    return;
                }

                const checkTable = "SHOW TABLES LIKE 'admins'";
                initDbInfo.query(checkTable, (err, results) => {
                    if (!err && results.length === 0) {
                        logger.info('Tables missing. Running database.sql...');
                        const sqlPath = path.join(__dirname, '../database.sql');
                        fs.readFile(sqlPath, 'utf8', (err, data) => {
                            if (err) {
                                logger.error('Error reading database.sql:', err);
                            } else {
                                initDbInfo.query(data, async (err) => {
                                    if (err) logger.error('Error executing SQL script:', err);
                                    else {
                                        logger.info('Database initialized from SQL script.');
                                        await updateDefaultAdmin();
                                        await runMigrations(initDbInfo);
                                    }
                                });
                            }
                        });
                    } else {
                        logger.info('Tables exist. Running migrations...');
                        runMigrations(initDbInfo);
                    }
                });
            });
        });
    });
}

async function updateDefaultAdmin() {
    try {
        const hashedPassword = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@12345', 10);
        const updateAdmin = 'UPDATE admins SET password_hash = ? WHERE username = ?';
        apiDb.query(updateAdmin, [hashedPassword, process.env.DEFAULT_ADMIN_USERNAME || 'admin'], (err) => {
            if (!err) logger.info('Updated default admin password to bcrypt hash.');
        });
    } catch (e) {
        logger.error('Error updating admin password:', e);
    }
}

async function runMigrations(connection) {
    logger.info('Running database migrations...');
    
    // Migration queries with conditional column addition
    const migrations = [
        // Check and add columns to admins
        `ALTER TABLE admins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`.replace('IF NOT EXISTS', ''),
        `ALTER TABLE admins ADD COLUMN IF NOT EXISTS role ENUM('super_admin', 'admin') DEFAULT 'admin'`.replace('IF NOT EXISTS', ''),
        `ALTER TABLE admins ADD COLUMN IF NOT EXISTS email VARCHAR(100) NULL`.replace('IF NOT EXISTS', ''),
        `ALTER TABLE admins ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255) NULL`.replace('IF NOT EXISTS', ''),
        `ALTER TABLE admins ADD COLUMN IF NOT EXISTS reset_token_expiry DATETIME NULL`.replace('IF NOT EXISTS', ''),
        
        // Check and add columns to donors
        `ALTER TABLE donors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`.replace('IF NOT EXISTS', ''),
        
        // Check and add columns to blood_requests
        `ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`.replace('IF NOT EXISTS', ''),
        `ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS is_emergency TINYINT(1) DEFAULT 0`.replace('IF NOT EXISTS', ''),
        
        // Create new tables
        `CREATE TABLE IF NOT EXISTS donations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            donor_id INT NOT NULL,
            donation_date DATE NOT NULL,
            location VARCHAR(150) NOT NULL,
            units INT DEFAULT 1,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE
        )`,
        
        `CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            recipient_email VARCHAR(100) NOT NULL,
            recipient_phone VARCHAR(20),
            subject VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            type ENUM('email', 'sms', 'both') DEFAULT 'email',
            status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
            sent_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        
        `CREATE TABLE IF NOT EXISTS donor_accounts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            donor_id INT NOT NULL UNIQUE,
            email VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            is_verified TINYINT(1) DEFAULT 0,
            verification_token VARCHAR(255),
            reset_token VARCHAR(255),
            reset_token_expiry DATETIME,
            last_login TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE
        )`,
        
        // Add indexes
        `CREATE INDEX idx_donors_blood_group ON donors(blood_group)`,
        `CREATE INDEX idx_donors_availability ON donors(availability)`,
        `CREATE INDEX idx_donors_email ON donors(email)`,
        `CREATE INDEX idx_requests_blood_group ON blood_requests(blood_group)`,
        `CREATE INDEX idx_requests_status ON blood_requests(status)`,
        `CREATE INDEX idx_requests_emergency ON blood_requests(is_emergency)`,
        
        // Update admin role
        `UPDATE admins SET role = 'super_admin' WHERE username = 'admin' AND role = 'admin'`
    ];

    for (const migration of migrations) {
        try {
            await new Promise((resolve, reject) => {
                connection.query(migration, (err, result) => {
                    if (err) {
                        // Ignore duplicate column/index errors
                        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME') {
                            resolve();
                        } else {
                            logger.warn(`Migration warning: ${err.message}`);
                            resolve(); // Continue with other migrations
                        }
                    } else {
                        resolve();
                    }
                });
            });
        } catch (e) {
            logger.error(`Migration error: ${e.message}`);
        }
    }

    logger.info('Database migrations completed.');
    connection.end();
}

initDatabase();

module.exports = apiDb;
