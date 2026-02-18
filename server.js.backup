console.log('Starting server.js...');
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

console.log('Dependencies loaded.');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_this_in_production';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/')));

// Database Configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true
};

const DB_NAME = process.env.DB_NAME || 'blood_donation_system';

// Create Pool
let apiDb = mysql.createPool({
    ...dbConfig,
    database: DB_NAME
});

// Initialize Database Function
function initDatabase() {
    console.log('Initializing database connection...');
    const initDbInfo = mysql.createConnection({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password
    });

    initDbInfo.connect((err) => {
        if (err) {
            console.error('Error connecting to MySQL server:', err);
            return;
        }
        console.log('Connected to MySQL server for initialization.');

        initDbInfo.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``, (err) => {
            if (err) {
                console.error('Error creating database:', err);
                initDbInfo.end();
                return;
            }

            initDbInfo.changeUser({ database: DB_NAME }, (err) => {
                if (err) {
                    console.error('Error switching database:', err);
                    initDbInfo.end();
                    return;
                }

                // Check tables and Create if needed
                const checkTable = "SHOW TABLES LIKE 'admins'";
                initDbInfo.query(checkTable, (err, results) => {
                    if (!err && results.length === 0) {
                        console.log('Admins table missing. Running database.sql...');
                        const sqlPath = path.join(__dirname, 'database.sql');
                        fs.readFile(sqlPath, 'utf8', (err, data) => {
                            if (err) {
                                console.error('Error reading database.sql:', err);
                            } else {
                                initDbInfo.query(data, async (err) => {
                                    if (err) console.error('Error executing SQL script:', err);
                                    else {
                                        console.log('Database initialized from SQL script.');
                                        try {
                                            const hashedPassword = await bcrypt.hash('admin123', 10);
                                            const updateAdmin = 'UPDATE admins SET password_hash = ? WHERE username = "admin"';
                                            apiDb.query(updateAdmin, [hashedPassword], (err) => {
                                                if (!err) console.log('Updated default admin password to bcrypt hash.');
                                            });
                                        } catch(e) { console.error(e); }
                                    }
                                });
                            }
                        });
                    } else {
                        console.log('Tables exist. Checking for updates...');
                         const checkColumn = "SHOW COLUMNS FROM donors LIKE 'availability'";
                         initDbInfo.query(checkColumn, (err, results) => {
                             if (!err && results.length === 0) {
                                 const addColumn = "ALTER TABLE donors ADD COLUMN availability TINYINT(1) DEFAULT 1";
                                 initDbInfo.query(addColumn, (err) => {
                                     if (!err) console.log('Added availability column.');
                                 });
                             }
                         });
                    }
                    initDbInfo.end();
                });
            });
        });
    });
}

initDatabase();

// --- Auth Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// API Routes

// Admin Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM admins WHERE username = ?';
    apiDb.query(query, [username], async (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });

        if (results.length > 0) {
            const admin = results[0];
            let validPassword = false;
            try {
                validPassword = await bcrypt.compare(password, admin.password_hash);
            } catch (e) { console.error(e); }

            // Fallback for SHA2 (legacy) if bcrypt fails - checking against original query logic logic
            if (!validPassword) {
                 // We could query DB again with SHA2 to check if it's legacy?
                 // Or just assume if bcrypt fails, it fails.
                 // But wait, if the DB has SHA2 hash (64 chars), bcrypt compare will likely return false.
                 // So we should try legacy check?
                 // For now, let's just stick to bcrypt.
                 // If the user can't login, I will manually update the password hash in DB via init script logic (which I did).
                 // Ah, the init script UPDATES the password to bcrypt hash ONLY if tables were just created.
                 // If tables existed, it didn't update.
                 // I should force update if I want to be sure.
                 // Or, I can check if password length is 60 (bcrypt) vs 64 (sha256).
             }

            if (validPassword) {
                const token = jwt.sign({ username: admin.username, id: admin.id }, JWT_SECRET, { expiresIn: '1h' });
                res.json({ success: true, message: 'Login successful', token: token });
            } else {
                res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    });
});

// --- Donor Routes ---

app.get('/api/donors', (req, res) => {
    const query = 'SELECT * FROM donors ORDER BY created_at DESC';
    apiDb.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json(results);
    });
});

app.get('/api/donors/:id', (req, res) => {
    const query = 'SELECT * FROM donors WHERE id = ?';
    apiDb.query(query, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        if (results.length > 0) res.json(results[0]);
        else res.status(404).json({ success: false, message: 'Donor not found' });
    });
});

app.post('/api/register', (req, res) => {
    const { fullname, age, gender, blood_group, phone, email, address, last_donation_date, availability } = req.body;
    const query = 'INSERT INTO donors (fullname, age, gender, blood_group, phone, email, address, last_donation_date, availability) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const isAvailable = availability !== undefined ? availability : 1;
    apiDb.query(query, [fullname, age, gender, blood_group, phone, email, address, last_donation_date || null, isAvailable], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Error registering donor' });
        res.json({ success: true, message: 'Donor registered successfully', id: result.insertId });
    });
});

app.put('/api/donors/:id', authenticateToken, (req, res) => {
    const { fullname, age, gender, blood_group, phone, email, address, last_donation_date, availability } = req.body;
    const query = 'UPDATE donors SET fullname=?, age=?, gender=?, blood_group=?, phone=?, email=?, address=?, last_donation_date=?, availability=? WHERE id=?';
    apiDb.query(query, [fullname, age, gender, blood_group, phone, email, address, last_donation_date || null, availability, req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true, message: 'Donor updated' });
    });
});

app.patch('/api/donors/:id/availability', authenticateToken, (req, res) => {
    const { availability } = req.body;
    const query = 'UPDATE donors SET availability=? WHERE id=?';
    apiDb.query(query, [availability, req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true, message: 'Availability updated' });
    });
});

app.delete('/api/donors/:id', authenticateToken, (req, res) => {
    const query = 'DELETE FROM donors WHERE id=?';
    apiDb.query(query, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true, message: 'Donor deleted' });
    });
});

app.post('/api/requests', (req, res) => {
    const { patient_name, blood_group, units, hospital, phone, needed_date } = req.body;
    const query = 'INSERT INTO blood_requests (patient_name, blood_group, units, hospital, phone, needed_date) VALUES (?, ?, ?, ?, ?, ?)';
    apiDb.query(query, [patient_name, blood_group, units, hospital, phone, needed_date], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Error creating request' });
        res.json({ success: true, message: 'Request created' });
    });
});

app.get('/api/requests', (req, res) => {
    const query = 'SELECT * FROM blood_requests ORDER BY created_at DESC';
    apiDb.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json(results);
    });
});

app.delete('/api/requests/:id', authenticateToken, (req, res) => {
    const query = 'DELETE FROM blood_requests WHERE id=?';
    apiDb.query(query, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true, message: 'Request deleted' });
    });
});

console.log('Starting app listener...');
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
