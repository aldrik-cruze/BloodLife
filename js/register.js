/**
 * register.js
 * Handles donor registration and editing form submission with API.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('registration-form');
    const urlParams = new URLSearchParams(window.location.search);
    const donorId = urlParams.get('id');

    // Edit Mode Check
    if (donorId) {
        try {
            const donor = await donorManager.getDonor(donorId);
            if (donor) {
                document.querySelector('h2').textContent = 'Edit Donor Details';
                const submitBtn = document.querySelector('button[type="submit"]');
                if(submitBtn) submitBtn.textContent = 'Update Donor';

                // Populate fields
                // Map API fields (snake_case) or mapped fields
                document.getElementById('fullname').value = donor.fullname || donor.name || '';
                document.getElementById('age').value = donor.age;
                document.getElementById('gender').value = donor.gender;
                document.getElementById('blood-group').value = donor.blood_group || donor.bloodGroup;
                document.getElementById('phone').value = donor.phone;
                document.getElementById('email').value = donor.email;
                document.getElementById('address').value = donor.address;

                // Date formatting for input type="date"
                let lastDonation = donor.last_donation_date || donor.lastDonation;
                if (lastDonation) {
                    // Start of ISO string '2025-01-01T...' -> '2025-01-01'
                    if(lastDonation.includes('T')) lastDonation = lastDonation.split('T')[0];
                    document.getElementById('last-donation').value = lastDonation;
                }
            } else {
                alert('Donor not found!');
                window.location.href = 'admin-dashboard.html';
            }
        } catch (e) {
            console.error("Error fetching donor for edit", e);
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Basic Validation
        const fullname = document.getElementById('fullname').value.trim();
        const age = document.getElementById('age').value;
        const gender = document.getElementById('gender').value;
        const bloodGroup = document.getElementById('blood-group').value;
        const phone = document.getElementById('phone').value.trim();
        const email = document.getElementById('email').value.trim();
        const address = document.getElementById('address').value.trim();
        const lastDonation = document.getElementById('last-donation').value;

        if (!fullname || !age || !gender || !bloodGroup || !phone || !email || !address) {
            alert('Please fill in all required fields.');
            return;
        }

        const donorData = {
            fullname: fullname, // API expects fullname if we send direct, but donor.js maps it?
            // checking donor.js: addDonor uses 'donor' object and splits it.
            // But we should send what donor.js expects.
            // donor.js addDonor expects 'donor' object.
            // It uses `donor.lastDonation` mapping to `last_donation_date`.
            // It sends `donor` object properties + `blood_group` mapping.
            // Let's stick to camelCase here and let donor.js handle mapping if it does (it does partial).
            // Actually, looking at my donor.js:
            /*
            const payload = {
                ...donor,
                last_donation_date: donor.lastDonation,
                blood_group: donor.bloodGroup
            };
            */
            // So if I send fullname, it sends fullname (which is correct for DB column `fullname`).
            // If I send bloodGroup, it maps to blood_group (correct).

            name: fullname, // For consistency if frontend uses .name elsewhere, but DB uses fullname
            fullname: fullname,
            age: parseInt(age),
            gender,
            bloodGroup, // donor.js maps this to blood_group
            phone,
            email,
            address,
            lastDonation // donor.js maps this to last_donation_date
        };

        try {
            if (donorId) {
                // Update Mode
                const result = await donorManager.updateDonor(donorId, donorData);
                if (result) {
                    alert('Donor details updated successfully!');
                    window.location.href = 'admin-dashboard.html';
                } else {
                    alert('Failed to update donor');
                }
            } else {
                // Register Mode
                // Date-based eligibility check warning
                if (donorData.lastDonation && !donorManager.isEligible(donorData.lastDonation)) {
                     if(!confirm("Based on the last donation date, this donor is not eligible to donate yet (must be > 3 months). Register anyway as Inactive?")) {
                         return;
                     }
                }

                await donorManager.addDonor(donorData);
                alert('Registration Successful! Thank you for being a donor.');
                form.reset();
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error(error);
            alert('An error occurred: ' + (error.message || 'Unknown error'));
        }
    });
});
