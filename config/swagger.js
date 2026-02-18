const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'BloodLife API Documentation',
            version: '1.0.0',
            description: 'Blood Donation Management System API',
            contact: {
                name: 'BloodLife Support',
                email: 'support@bloodlife.com'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                Donor: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        fullname: { type: 'string' },
                        age: { type: 'integer' },
                        gender: { type: 'string', enum: ['Male', 'Female', 'Other'] },
                        blood_group: { type: 'string', enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
                        phone: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        address: { type: 'string' },
                        last_donation_date: { type: 'string', format: 'date', nullable: true },
                        availability: { type: 'boolean' },
                        created_at: { type: 'string', format: 'date-time' }
                    }
                },
                BloodRequest: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        patient_name: { type: 'string' },
                        blood_group: { type: 'string', enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
                        units: { type: 'integer' },
                        hospital: { type: 'string' },
                        phone: { type: 'string' },
                        needed_date: { type: 'string', format: 'date' },
                        is_emergency: { type: 'boolean' },
                        status: { type: 'string', enum: ['Pending', 'Approved', 'Rejected', 'Fulfilled'] },
                        created_at: { type: 'string', format: 'date-time' }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string' }
                    }
                }
            }
        },
        security: [
            {
                bearerAuth: []
            }
        ]
    },
    apis: ['./routes/*.js', './server.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerUi, swaggerSpec };
