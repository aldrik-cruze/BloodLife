-- Migration: Add new fields and tables for enhanced features
-- Run this after the initial database.sql

USE blood_donation_system;

-- Add columns to tables (check if exists first using ALTER IGNORE for MySQL compatibility)
-- For admins table
ALTER TABLE admins 
  ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN role ENUM('super_admin', 'admin') DEFAULT 'admin',
  ADD COLUMN email VARCHAR(100) NULL,
  ADD COLUMN reset_token VARCHAR(255) NULL,
  ADD COLUMN reset_token_expiry DATETIME NULL;

-- For donors table
ALTER TABLE donors 
  ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- For blood_requests table  
ALTER TABLE blood_requests 
  ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN is_emergency TINYINT(1) DEFAULT 0;

-- Create donations history table
CREATE TABLE IF NOT EXISTS donations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donor_id INT NOT NULL,
    donation_date DATE NOT NULL,
    location VARCHAR(150) NOT NULL,
    units INT DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
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
);

-- Create donor_accounts table for donor self-service
CREATE TABLE IF NOT EXISTS donor_accounts (
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
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_donors_blood_group ON donors(blood_group);
CREATE INDEX IF NOT EXISTS idx_donors_availability ON donors(availability);
CREATE INDEX IF NOT EXISTS idx_donors_email ON donors(email);
CREATE INDEX IF NOT EXISTS idx_requests_blood_group ON blood_requests(blood_group);
CREATE INDEX IF NOT EXISTS idx_requests_status ON blood_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_emergency ON blood_requests(is_emergency);
CREATE INDEX IF NOT EXISTS idx_donations_donor_id ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_date ON donations(donation_date);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- Update first admin to super_admin if exists
UPDATE admins SET role = 'super_admin' WHERE username = 'admin' AND role = 'admin';
