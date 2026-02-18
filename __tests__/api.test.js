const request = require('supertest');
const app = require('../server');

describe('API Health Check', () => {
    it('GET /api/health should return 200', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
