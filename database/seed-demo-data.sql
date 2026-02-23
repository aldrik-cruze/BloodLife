-- Demo Data for Blood Donation System
-- 15 Complete Donor Profiles with varied data

USE blood_donation_system;

-- Clear existing demo data (optional - comment out if you want to keep existing data)
-- DELETE FROM donor_accounts WHERE donor_id IN (SELECT id FROM donors WHERE email LIKE '%demo%');
-- DELETE FROM donors WHERE email LIKE '%demo%';

-- Insert 15 Demo Donors
INSERT INTO donors (fullname, age, gender, blood_group, phone, email, address, last_donation_date, availability) VALUES
-- Blood Group O+ (Universal Donor for Positive)
('John Anderson', 28, 'Male', 'O+', '+1-555-0101', 'john.anderson@demo.com', '123 Maple Street, New York, NY 10001', '2025-11-15', 1),
('Sarah Williams', 32, 'Female', 'O+', '+1-555-0102', 'sarah.williams@demo.com', '456 Oak Avenue, Los Angeles, CA 90001', NULL, 1),
('Michael Chen', 25, 'Male', 'O+', '+1-555-0103', 'michael.chen@demo.com', '789 Pine Road, Chicago, IL 60601', '2025-12-20', 1),

-- Blood Group O- (Universal Donor)
('Emily Rodriguez', 30, 'Female', 'O-', '+1-555-0104', 'emily.rodriguez@demo.com', '321 Elm Street, Houston, TX 77001', '2025-10-10', 1),
('David Kim', 35, 'Male', 'O-', '+1-555-0105', 'david.kim@demo.com', '654 Birch Lane, Phoenix, AZ 85001', NULL, 1),

-- Blood Group A+
('Jessica Taylor', 27, 'Female', 'A+', '+1-555-0106', 'jessica.taylor@demo.com', '987 Cedar Court, Philadelphia, PA 19019', '2026-01-05', 0),
('Robert Johnson', 40, 'Male', 'A+', '+1-555-0107', 'robert.johnson@demo.com', '147 Spruce Street, San Antonio, TX 78201', NULL, 1),
('Amanda Lee', 29, 'Female', 'A+', '+1-555-0108', 'amanda.lee@demo.com', '258 Willow Drive, San Diego, CA 92101', '2025-09-15', 1),

-- Blood Group A-
('Christopher Brown', 33, 'Male', 'A-', '+1-555-0109', 'christopher.brown@demo.com', '369 Redwood Way, Dallas, TX 75201', NULL, 1),

-- Blood Group B+
('Jennifer Martinez', 26, 'Female', 'B+', '+1-555-0110', 'jennifer.martinez@demo.com', '741 Cypress Avenue, San Jose, CA 95101', '2025-11-30', 1),
('James Wilson', 38, 'Male', 'B+', '+1-555-0111', 'james.wilson@demo.com', '852 Magnolia Street, Austin, TX 78701', NULL, 1),

-- Blood Group B-
('Michelle Garcia', 31, 'Female', 'B-', '+1-555-0112', 'michelle.garcia@demo.com', '963 Poplar Road, Jacksonville, FL 32099', '2026-01-20', 0),

-- Blood Group AB+
('Daniel Moore', 34, 'Male', 'AB+', '+1-555-0113', 'daniel.moore@demo.com', '159 Hickory Lane, Fort Worth, TX 76101', NULL, 1),

-- Blood Group AB-
('Lisa Thompson', 28, 'Female', 'AB-', '+1-555-0114', 'lisa.thompson@demo.com', '357 Ash Boulevard, Columbus, OH 43004', '2025-12-05', 1),
('Kevin White', 36, 'Male', 'AB-', '+1-555-0115', 'kevin.white@demo.com', '486 Sycamore Circle, Charlotte, NC 28201', NULL, 1);

-- Get the inserted donor IDs
SET @donor1_id = (SELECT id FROM donors WHERE email = 'john.anderson@demo.com');
SET @donor2_id = (SELECT id FROM donors WHERE email = 'sarah.williams@demo.com');
SET @donor3_id = (SELECT id FROM donors WHERE email = 'emily.rodriguez@demo.com');
SET @donor4_id = (SELECT id FROM donors WHERE email = 'jessica.taylor@demo.com');
SET @donor5_id = (SELECT id FROM donors WHERE email = 'robert.johnson@demo.com');
SET @donor6_id = (SELECT id FROM donors WHERE email = 'daniel.moore@demo.com');
SET @donor7_id = (SELECT id FROM donors WHERE email = 'lisa.thompson@demo.com');
SET @donor8_id = (SELECT id FROM donors WHERE email = 'amanda.lee@demo.com');

-- Create donor accounts for 8 donors (password for all: Demo@12345)
-- Password hash generated with bcrypt for 'Demo@12345'
INSERT INTO donor_accounts (donor_id, email, password_hash, is_verified) VALUES
(@donor1_id, 'john.anderson@demo.com', '$2a$10$vKzN8KJxTqXqGkYZN3QzOuVqN5nK4wEYLGzKLZN2YXqZ5nK4wEYLG', 1),
(@donor2_id, 'sarah.williams@demo.com', '$2a$10$vKzN8KJxTqXqGkYZN3QzOuVqN5nK4wEYLGzKLZN2YXqZ5nK4wEYLG', 1),
(@donor3_id, 'emily.rodriguez@demo.com', '$2a$10$vKzN8KJxTqXqGkYZN3QzOuVqN5nK4wEYLGzKLZN2YXqZ5nK4wEYLG', 1),
(@donor4_id, 'jessica.taylor@demo.com', '$2a$10$vKzN8KJxTqXqGkYZN3QzOuVqN5nK4wEYLGzKLZN2YXqZ5nK4wEYLG', 1),
(@donor5_id, 'robert.johnson@demo.com', '$2a$10$vKzN8KJxTqXqGkYZN3QzOuVqN5nK4wEYLGzKLZN2YXqZ5nK4wEYLG', 1),
(@donor6_id, 'daniel.moore@demo.com', '$2a$10$vKzN8KJxTqXqGkYZN3QzOuVqN5nK4wEYLGzKLZN2YXqZ5nK4wEYLG', 1),
(@donor7_id, 'lisa.thompson@demo.com', '$2a$10$vKzN8KJxTqXqGkYZN3QzOuVqN5nK4wEYLGzKLZN2YXqZ5nK4wEYLG', 1),
(@donor8_id, 'amanda.lee@demo.com', '$2a$10$vKzN8KJxTqXqGkYZN3QzOuVqN5nK4wEYLGzKLZN2YXqZ5nK4wEYLG', 1);

-- Add some donation history for active donors
INSERT INTO donations (donor_id, donation_date, location, units, notes) VALUES
(@donor1_id, '2025-11-15', 'New York Blood Center', 1, 'Regular donation'),
(@donor1_id, '2025-08-10', 'Manhattan Hospital', 1, 'Regular donation'),
(@donor1_id, '2025-05-05', 'NYC Medical Center', 1, 'Regular donation'),

(@donor3_id, '2025-10-10', 'Houston Medical Center', 1, 'Emergency request'),
(@donor3_id, '2025-07-12', 'Houston Blood Bank', 1, 'Regular donation'),

(@donor4_id, '2026-01-05', 'Philadelphia General', 1, 'Regular donation'),
(@donor4_id, '2025-10-08', 'Philly Blood Center', 1, 'Regular donation'),

(@donor7_id, '2025-12-05', 'Columbus Hospital', 1, 'Regular donation'),
(@donor7_id, '2025-09-01', 'Ohio Blood Services', 1, 'Regular donation'),
(@donor7_id, '2025-06-15', 'Columbus Medical', 1, 'Regular donation'),
(@donor7_id, '2025-03-10', 'Central Ohio Blood', 1, 'Regular donation'),

(@donor8_id, '2025-09-15', 'San Diego Blood Bank', 1, 'Regular donation'),
(@donor8_id, '2025-06-20', 'California Blood Center', 1, 'Regular donation');

-- Add some blood requests for testing
INSERT INTO blood_requests (patient_name, blood_group, units, hospital, phone, needed_date, is_emergency, status) VALUES
('Maria Garcia', 'O+', 2, 'City General Hospital', '+1-555-1001', '2026-02-20', 1, 'Pending'),
('Tom Bradley', 'A-', 1, 'Memorial Hospital', '+1-555-1002', '2026-02-22', 0, 'Pending'),
('Alice Johnson', 'B+', 3, 'St. Mary Medical Center', '+1-555-1003', '2026-02-25', 0, 'Pending'),
('Robert Davis', 'O-', 1, 'Emergency Care Hospital', '+1-555-1004', '2026-02-19', 1, 'Approved'),
('Susan Miller', 'AB+', 2, 'University Hospital', '+1-555-1005', '2026-03-01', 0, 'Pending'),
('David Wilson', 'A+', 1, 'Central Hospital', '+1-555-1006', '2026-02-28', 0, 'Fulfilled'),
('Emma Brown', 'O+', 2, 'Regional Medical Center', '+1-555-1007', '2026-02-18', 1, 'Approved');

-- Display summary
SELECT 'Demo Data Inserted Successfully!' as Status;
SELECT COUNT(*) as 'Total Donors' FROM donors WHERE email LIKE '%demo%';
SELECT COUNT(*) as 'Donors with Accounts' FROM donor_accounts WHERE email LIKE '%demo%';
SELECT COUNT(*) as 'Total Donations' FROM donations;
SELECT COUNT(*) as 'Total Blood Requests' FROM blood_requests;

-- Display blood group distribution
SELECT 
    blood_group as 'Blood Group',
    COUNT(*) as 'Count',
    SUM(CASE WHEN availability = 1 THEN 1 ELSE 0 END) as 'Available'
FROM donors 
WHERE email LIKE '%demo%'
GROUP BY blood_group
ORDER BY blood_group;
