require('dotenv').config();
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'blood_donation_system',
    multipleStatements: true
};

console.log('🌱 Starting demo data seeding...\n');

const connection = mysql.createConnection(dbConfig);

connection.connect(async (err) => {
    if (err) {
        console.error('❌ Error connecting to database:', err);
        process.exit(1);
    }

    console.log('✅ Connected to database\n');

    try {
        // Generate password hash for demo accounts
        const demoPassword = 'Demo@12345';
        const passwordHash = await bcrypt.hash(demoPassword, 10);
        console.log('🔐 Generated password hash for demo accounts');
        console.log(`   Password: ${demoPassword}\n`);

        // Demo donors data
        const donors = [
            // O+ (3 donors)
            { fullname: 'John Anderson', age: 28, gender: 'Male', blood_group: 'O+', phone: '+1-555-0101', email: 'john.anderson@demo.com', address: '123 Maple Street, New York, NY 10001', last_donation_date: '2025-11-15', availability: 1 },
            { fullname: 'Sarah Williams', age: 32, gender: 'Female', blood_group: 'O+', phone: '+1-555-0102', email: 'sarah.williams@demo.com', address: '456 Oak Avenue, Los Angeles, CA 90001', last_donation_date: null, availability: 1 },
            { fullname: 'Michael Chen', age: 25, gender: 'Male', blood_group: 'O+', phone: '+1-555-0103', email: 'michael.chen@demo.com', address: '789 Pine Road, Chicago, IL 60601', last_donation_date: '2025-12-20', availability: 1 },
            
            // O- (2 donors)
            { fullname: 'Emily Rodriguez', age: 30, gender: 'Female', blood_group: 'O-', phone: '+1-555-0104', email: 'emily.rodriguez@demo.com', address: '321 Elm Street, Houston, TX 77001', last_donation_date: '2025-10-10', availability: 1 },
            { fullname: 'David Kim', age: 35, gender: 'Male', blood_group: 'O-', phone: '+1-555-0105', email: 'david.kim@demo.com', address: '654 Birch Lane, Phoenix, AZ 85001', last_donation_date: null, availability: 1 },
            
            // A+ (3 donors)
            { fullname: 'Jessica Taylor', age: 27, gender: 'Female', blood_group: 'A+', phone: '+1-555-0106', email: 'jessica.taylor@demo.com', address: '987 Cedar Court, Philadelphia, PA 19019', last_donation_date: '2026-01-05', availability: 0 },
            { fullname: 'Robert Johnson', age: 40, gender: 'Male', blood_group: 'A+', phone: '+1-555-0107', email: 'robert.johnson@demo.com', address: '147 Spruce Street, San Antonio, TX 78201', last_donation_date: null, availability: 1 },
            { fullname: 'Amanda Lee', age: 29, gender: 'Female', blood_group: 'A+', phone: '+1-555-0108', email: 'amanda.lee@demo.com', address: '258 Willow Drive, San Diego, CA 92101', last_donation_date: '2025-09-15', availability: 1 },
            
            // A- (1 donor)
            { fullname: 'Christopher Brown', age: 33, gender: 'Male', blood_group: 'A-', phone: '+1-555-0109', email: 'christopher.brown@demo.com', address: '369 Redwood Way, Dallas, TX 75201', last_donation_date: null, availability: 1 },
            
            // B+ (2 donors)
            { fullname: 'Jennifer Martinez', age: 26, gender: 'Female', blood_group: 'B+', phone: '+1-555-0110', email: 'jennifer.martinez@demo.com', address: '741 Cypress Avenue, San Jose, CA 95101', last_donation_date: '2025-11-30', availability: 1 },
            { fullname: 'James Wilson', age: 38, gender: 'Male', blood_group: 'B+', phone: '+1-555-0111', email: 'james.wilson@demo.com', address: '852 Magnolia Street, Austin, TX 78701', last_donation_date: null, availability: 1 },
            
            // B- (1 donor)
            { fullname: 'Michelle Garcia', age: 31, gender: 'Female', blood_group: 'B-', phone: '+1-555-0112', email: 'michelle.garcia@demo.com', address: '963 Poplar Road, Jacksonville, FL 32099', last_donation_date: '2026-01-20', availability: 0 },
            
            // AB+ (1 donor)
            { fullname: 'Daniel Moore', age: 34, gender: 'Male', blood_group: 'AB+', phone: '+1-555-0113', email: 'daniel.moore@demo.com', address: '159 Hickory Lane, Fort Worth, TX 76101', last_donation_date: null, availability: 1 },
            
            // AB- (2 donors)
            { fullname: 'Lisa Thompson', age: 28, gender: 'Female', blood_group: 'AB-', phone: '+1-555-0114', email: 'lisa.thompson@demo.com', address: '357 Ash Boulevard, Columbus, OH 43004', last_donation_date: '2025-12-05', availability: 1 },
            { fullname: 'Kevin White', age: 36, gender: 'Male', blood_group: 'AB-', phone: '+1-555-0115', email: 'kevin.white@demo.com', address: '486 Sycamore Circle, Charlotte, NC 28201', last_donation_date: null, availability: 1 }
        ];

        console.log('👥 Inserting 15 demo donors...');
        
        const donorIds = [];
        for (const donor of donors) {
            const query = 'INSERT INTO donors (fullname, age, gender, blood_group, phone, email, address, last_donation_date, availability) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
            const values = [donor.fullname, donor.age, donor.gender, donor.blood_group, donor.phone, donor.email, donor.address, donor.last_donation_date, donor.availability];
            
            const result = await new Promise((resolve, reject) => {
                connection.query(query, values, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
            
            donorIds.push({ id: result.insertId, email: donor.email, name: donor.fullname });
            console.log(`   ✓ ${donor.fullname} (${donor.blood_group})`);
        }

        console.log(`\n✅ Inserted ${donorIds.length} donors\n`);

        // Create accounts for 8 donors
        console.log('🔑 Creating donor accounts...');
        const accountEmails = [
            'john.anderson@demo.com',
            'sarah.williams@demo.com',
            'emily.rodriguez@demo.com',
            'jessica.taylor@demo.com',
            'robert.johnson@demo.com',
            'daniel.moore@demo.com',
            'lisa.thompson@demo.com',
            'amanda.lee@demo.com'
        ];

        let accountCount = 0;
        for (const email of accountEmails) {
            const donor = donorIds.find(d => d.email === email);
            if (donor) {
                const accountQuery = 'INSERT INTO donor_accounts (donor_id, email, password_hash, is_verified) VALUES (?, ?, ?, 1)';
                await new Promise((resolve, reject) => {
                    connection.query(accountQuery, [donor.id, email, passwordHash], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                accountCount++;
                console.log(`   ✓ Account created for ${donor.name}`);
            }
        }

        console.log(`\n✅ Created ${accountCount} donor accounts\n`);

        // Add donation history
        console.log('📜 Adding donation history...');
        const donations = [
            { email: 'john.anderson@demo.com', donations: [
                { date: '2025-11-15', location: 'New York Blood Center', units: 1, notes: 'Regular donation' },
                { date: '2025-08-10', location: 'Manhattan Hospital', units: 1, notes: 'Regular donation' },
                { date: '2025-05-05', location: 'NYC Medical Center', units: 1, notes: 'Regular donation' }
            ]},
            { email: 'emily.rodriguez@demo.com', donations: [
                { date: '2025-10-10', location: 'Houston Medical Center', units: 1, notes: 'Emergency request' },
                { date: '2025-07-12', location: 'Houston Blood Bank', units: 1, notes: 'Regular donation' }
            ]},
            { email: 'jessica.taylor@demo.com', donations: [
                { date: '2026-01-05', location: 'Philadelphia General', units: 1, notes: 'Regular donation' },
                { date: '2025-10-08', location: 'Philly Blood Center', units: 1, notes: 'Regular donation' }
            ]},
            { email: 'lisa.thompson@demo.com', donations: [
                { date: '2025-12-05', location: 'Columbus Hospital', units: 1, notes: 'Regular donation' },
                { date: '2025-09-01', location: 'Ohio Blood Services', units: 1, notes: 'Regular donation' },
                { date: '2025-06-15', location: 'Columbus Medical', units: 1, notes: 'Regular donation' },
                { date: '2025-03-10', location: 'Central Ohio Blood', units: 1, notes: 'Regular donation' }
            ]},
            { email: 'amanda.lee@demo.com', donations: [
                { date: '2025-09-15', location: 'San Diego Blood Bank', units: 1, notes: 'Regular donation' },
                { date: '2025-06-20', location: 'California Blood Center', units: 1, notes: 'Regular donation' }
            ]}
        ];

        let donationCount = 0;
        for (const donorDonations of donations) {
            const donor = donorIds.find(d => d.email === donorDonations.email);
            if (donor) {
                for (const donation of donorDonations.donations) {
                    const donationQuery = 'INSERT INTO donations (donor_id, donation_date, location, units, notes) VALUES (?, ?, ?, ?, ?)';
                    await new Promise((resolve, reject) => {
                        connection.query(donationQuery, [donor.id, donation.date, donation.location, donation.units, donation.notes], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    donationCount++;
                }
                console.log(`   ✓ Added ${donorDonations.donations.length} donations for ${donor.name}`);
            }
        }

        console.log(`\n✅ Added ${donationCount} donation records\n`);

        // Add blood requests
        console.log('🩸 Adding blood requests...');
        const requests = [
            { patient_name: 'Maria Garcia', blood_group: 'O+', units: 2, hospital: 'City General Hospital', phone: '+1-555-1001', needed_date: '2026-02-20', is_emergency: 1, status: 'Pending' },
            { patient_name: 'Tom Bradley', blood_group: 'A-', units: 1, hospital: 'Memorial Hospital', phone: '+1-555-1002', needed_date: '2026-02-22', is_emergency: 0, status: 'Pending' },
            { patient_name: 'Alice Johnson', blood_group: 'B+', units: 3, hospital: 'St. Mary Medical Center', phone: '+1-555-1003', needed_date: '2026-02-25', is_emergency: 0, status: 'Pending' },
            { patient_name: 'Robert Davis', blood_group: 'O-', units: 1, hospital: 'Emergency Care Hospital', phone: '+1-555-1004', needed_date: '2026-02-19', is_emergency: 1, status: 'Approved' },
            { patient_name: 'Susan Miller', blood_group: 'AB+', units: 2, hospital: 'University Hospital', phone: '+1-555-1005', needed_date: '2026-03-01', is_emergency: 0, status: 'Pending' },
            { patient_name: 'David Wilson', blood_group: 'A+', units: 1, hospital: 'Central Hospital', phone: '+1-555-1006', needed_date: '2026-02-28', is_emergency: 0, status: 'Fulfilled' },
            { patient_name: 'Emma Brown', blood_group: 'O+', units: 2, hospital: 'Regional Medical Center', phone: '+1-555-1007', needed_date: '2026-02-18', is_emergency: 1, status: 'Approved' }
        ];

        for (const request of requests) {
            const requestQuery = 'INSERT INTO blood_requests (patient_name, blood_group, units, hospital, phone, needed_date, is_emergency, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
            await new Promise((resolve, reject) => {
                connection.query(requestQuery, [request.patient_name, request.blood_group, request.units, request.hospital, request.phone, request.needed_date, request.is_emergency, request.status], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log(`   ✓ ${request.patient_name} needs ${request.blood_group} (${request.status})`);
        }

        console.log(`\n✅ Added ${requests.length} blood requests\n`);

        // Display summary
        console.log('📊 Summary:');
        console.log('━'.repeat(60));
        
        const stats = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT 
                    (SELECT COUNT(*) FROM donors WHERE email LIKE '%demo%') as total_donors,
                    (SELECT COUNT(*) FROM donor_accounts WHERE email LIKE '%demo%') as total_accounts,
                    (SELECT COUNT(*) FROM donations) as total_donations,
                    (SELECT COUNT(*) FROM blood_requests) as total_requests
            `, (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });

        console.log(`   Total Donors: ${stats.total_donors}`);
        console.log(`   Donor Accounts: ${stats.total_accounts}`);
        console.log(`   Donation Records: ${stats.total_donations}`);
        console.log(`   Blood Requests: ${stats.total_requests}`);

        // Blood group distribution
        const distribution = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT 
                    blood_group,
                    COUNT(*) as total,
                    SUM(CASE WHEN availability = 1 THEN 1 ELSE 0 END) as available
                FROM donors 
                WHERE email LIKE '%demo%'
                GROUP BY blood_group
                ORDER BY blood_group
            `, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        console.log('\n   Blood Group Distribution:');
        distribution.forEach(row => {
            console.log(`      ${row.blood_group}: ${row.total} donors (${row.available} available)`);
        });

        console.log('\n' + '━'.repeat(60));
        console.log('\n✅ Demo data seeding completed successfully!\n');
        console.log('📝 Login credentials for demo donor accounts:');
        console.log('   Email: any of the 8 account emails above');
        console.log('   Password: Demo@12345\n');
        console.log('💡 You can now:');
        console.log('   - Login as any demo donor');
        console.log('   - View their dashboard');
        console.log('   - Search for donors on home page');
        console.log('   - View blood requests in admin panel\n');

    } catch (error) {
        console.error('❌ Error seeding data:', error);
    } finally {
        connection.end();
        console.log('👋 Database connection closed\n');
    }
});
