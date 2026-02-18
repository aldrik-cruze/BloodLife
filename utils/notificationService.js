const nodemailer = require('nodemailer');
const logger = require('./logger');

class NotificationService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });
    }

    async sendEmail(to, subject, html) {
        try {
            if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
                logger.warn('Email credentials not configured, skipping email send');
                return { success: false, message: 'Email not configured' };
            }

            const info = await this.transporter.sendMail({
                from: process.env.EMAIL_FROM || '"BloodLife" <noreply@bloodlife.com>',
                to,
                subject,
                html
            });

            logger.info(`Email sent: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            logger.error(`Email send failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async notifyDonorMatch(donorEmail, donorName, requestDetails) {
        const subject = '🩸 Blood Donation Request Match';
        const html = `
            <h2>Hello ${donorName},</h2>
            <p>There is an urgent blood donation request that matches your blood group!</p>
            <h3>Request Details:</h3>
            <ul>
                <li><strong>Patient:</strong> ${requestDetails.patient_name}</li>
                <li><strong>Blood Group:</strong> ${requestDetails.blood_group}</li>
                <li><strong>Units Needed:</strong> ${requestDetails.units}</li>
                <li><strong>Hospital:</strong> ${requestDetails.hospital}</li>
                <li><strong>Contact:</strong> ${requestDetails.phone}</li>
                <li><strong>Date Needed:</strong> ${new Date(requestDetails.needed_date).toLocaleDateString()}</li>
            </ul>
            <p>Your donation can save a life. Please contact the hospital if you're available to donate.</p>
            <p>Thank you for being a lifesaver!</p>
            <p><em>BloodLife Team</em></p>
        `;

        return await this.sendEmail(donorEmail, subject, html);
    }

    async notifyRequestStatusUpdate(requesterId, status, requestDetails) {
        const statusMessages = {
            'Approved': 'has been approved',
            'Fulfilled': 'has been fulfilled',
            'Rejected': 'could not be processed at this time'
        };

        const subject = `Blood Request ${status}`;
        const html = `
            <h2>Blood Request Update</h2>
            <p>Your blood request for <strong>${requestDetails.blood_group}</strong> ${statusMessages[status]}.</p>
            <h3>Request Details:</h3>
            <ul>
                <li><strong>Patient:</strong> ${requestDetails.patient_name}</li>
                <li><strong>Blood Group:</strong> ${requestDetails.blood_group}</li>
                <li><strong>Units:</strong> ${requestDetails.units}</li>
                <li><strong>Hospital:</strong> ${requestDetails.hospital}</li>
            </ul>
            <p>Thank you for using BloodLife.</p>
        `;

        return await this.sendEmail(requesterId, subject, html);
    }

    async sendWelcomeEmail(email, name) {
        const subject = 'Welcome to BloodLife!';
        const html = `
            <h2>Welcome ${name}!</h2>
            <p>Thank you for registering as a blood donor with BloodLife.</p>
            <p>Your generosity can save lives. We'll notify you when there's a blood request matching your blood group.</p>
            <p>You can update your availability status anytime through your profile.</p>
            <p><strong>Remember:</strong> You can donate blood every 90 days.</p>
            <p>Stay healthy and keep saving lives!</p>
            <p><em>BloodLife Team</em></p>
        `;

        return await this.sendEmail(email, subject, html);
    }
}

module.exports = new NotificationService();
