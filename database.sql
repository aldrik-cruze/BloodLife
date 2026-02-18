-- Database Creation
CREATE DATABASE IF NOT EXISTS blood_donation_system;
USE blood_donation_system;

-- Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Donors Table
CREATE TABLE IF NOT EXISTS donors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fullname VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-') NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    address TEXT NOT NULL,
    last_donation_date DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blood Requests Table
CREATE TABLE IF NOT EXISTS blood_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_name VARCHAR(100) NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-') NOT NULL,
    units INT NOT NULL,
    hospital VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    needed_date DATE NOT NULL,
    status ENUM('Pending', 'Approved', 'Rejected', 'Fulfilled') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a default admin user (password: admin123 - hashed using SHA2 for demo purposes,
-- in production use a secure hashing algorithm like bcrypt)
INSERT INTO admins (username, password_hash)
SELECT 'admin', SHA2('admin123', 256)
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = 'admin');
