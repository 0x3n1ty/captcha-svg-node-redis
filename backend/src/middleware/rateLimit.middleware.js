// src/middleware/rateLimit.middleware.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;  // Note the .default
const { getRedisClient } = require('../config/redis');
require('dotenv').config();

/**
 * Create rate limiter for login endpoint
 * Uses Redis for distributed rate limiting
 */
const createLoginRateLimiter = async () => {
    try {
        const redisClient = await getRedisClient();
        
        // Create the rate limiter
        const limiter = rateLimit({
            windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000, // 15 minutes default
            max: parseInt(process.env.RATE_LIMIT_MAX) || 5, // 5 requests per window
            standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
            legacyHeaders: false, // Disable the `X-RateLimit-*` headers
            
            // Use Redis store for distributed rate limiting
            store: new RedisStore({
                prefix: 'rate_limit:login:',
                // Use the Redis client directly
                sendCommand: (...args) => redisClient.sendCommand(args),
            }),
            
            // Skip successful requests? No - count all attempts
            skipSuccessfulRequests: false,
            
            // Key generator - use IP + user agent for better fingerprinting
            keyGenerator: (req) => {
                const ip = req.ip || req.connection.remoteAddress || 'unknown';
                const userAgent = req.get('user-agent') || 'unknown';
                // Create a hash of IP + UA to prevent distributed attacks
                const crypto = require('crypto');
                return crypto
                    .createHash('sha256')
                    .update(ip + userAgent)
                    .digest('hex')
                    .substring(0, 32);
            },
            
            // Handler when rate limit exceeded
            handler: (req, res) => {
                console.warn(`[RATE LIMIT] IP ${req.ip} exceeded limit`);
                return res.status(429).json({
                    success: false,
                    message: 'Too many login attempts. Please try again later.',
                    retryAfter: Math.ceil(req.rateLimit.resetTime / 1000) - Math.floor(Date.now() / 1000)
                });
            },
            
            // Skip certain requests (e.g., health checks)
            skip: (req) => {
                return req.path === '/health' || req.path === '/favicon.ico';
            }
        });

        return limiter;
    } catch (error) {
        console.error('Failed to create rate limiter:', error);
        // Return a basic rate limiter without Redis as fallback
        return rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 5,
            handler: (req, res) => {
                res.status(429).json({
                    success: false,
                    message: 'Too many login attempts. Please try again later.'
                });
            }
        });
    }
};

/**
 * Middleware to add rate limit headers
 */
const addRateLimitHeaders = (req, res, next) => {
    if (req.rateLimit) {
        res.set({
            'X-RateLimit-Limit': req.rateLimit.limit,
            'X-RateLimit-Remaining': req.rateLimit.remaining,
            'X-RateLimit-Reset': req.rateLimit.resetTime
        });
    }
    next();
};

module.exports = {
    createLoginRateLimiter,
    addRateLimitHeaders
};
