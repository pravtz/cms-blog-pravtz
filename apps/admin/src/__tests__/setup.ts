/**
 * Global test setup: set required environment variables before any test runs.
 */
process.env.JWT_SECRET = 'test-jwt-secret-32-chars-minimum!!'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars-min!'
process.env.NODE_ENV = 'test'
