module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'routes/**/*.js',
        'middleware/**/*.js',
        'utils/**/*.js',
        '!node_modules/**',
        '!coverage/**'
    ],
    testMatch: [
        '**/__tests__/**/*.test.js'
    ],
    verbose: true,
    testTimeout: 10000
};
