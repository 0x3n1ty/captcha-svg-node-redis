// src/middleware/rateLimit.middleware.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
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
            standardHeaders: true,
            legacyHeaders: false,
            
            store: new RedisStore({
                prefix: 'rate_limit:login:',
                sendCommand: (...args) => redisClient.sendCommand(args),
            }),
            
            skipSuccessfulRequests: false,
            
            keyGenerator: (req) => {
                const ip = req.ip || req.connection.remoteAddress || 'unknown';
                const userAgent = req.get('user-agent') || 'unknown';
                const crypto = require('crypto');
                return crypto
                    .createHash('sha256')
                    .update(ip + userAgent)
                    .digest('hex')
                    .substring(0, 32);
            },
            
            handler: (req, res) => {
                console.warn(`[RATE LIMIT] IP ${req.ip} exceeded login limit`);
                return res.status(429).json({
                    success: false,
                    message: 'Too many login attempts. Please try again later.',
                    retryAfter: Math.ceil(req.rateLimit.resetTime / 1000) - Math.floor(Date.now() / 1000)
                });
            },
            
            skip: (req) => {
                return req.path === '/health' || req.path === '/favicon.ico';
            }
        });

        return limiter;
    } catch (error) {
        console.error('Failed to create login rate limiter:', error);
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
 * Rate Limiter for captcha generation - configurable via .env
 */
const captchaLimiter = rateLimit({
    // Get values from .env with defaults
    windowMs: (parseInt(process.env.CAPTCHA_RATE_WINDOW) || 1) * 60 * 1000, // Default: 1 minute
    max: parseInt(process.env.CAPTCHA_RATE_MAX) || 10, // Default: 10 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: `Too many captcha requests. Maximum ${parseInt(process.env.CAPTCHA_RATE_MAX) || 10} requests per ${parseInt(process.env.CAPTCHA_RATE_WINDOW) || 1} minute(s). Please slow down.`
    },
    // Use a store that gets Redis client dynamically
    store: new RedisStore({
        prefix: 'rate_limit:captcha:',
        sendCommand: async (...args) => {
            const client = await getRedisClient();
            return client.sendCommand(args);
        }
    }),
    keyGenerator: (req) => {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('user-agent') || 'unknown';
        const crypto = require('crypto');
        return crypto
            .createHash('sha256')
            .update(ip + userAgent)
            .digest('hex')
            .substring(0, 32);
    },
    handler: (req, res) => {
        const windowMs = parseInt(process.env.CAPTCHA_RATE_WINDOW) || 1;
        const max = parseInt(process.env.CAPTCHA_RATE_MAX) || 10;
        
        console.warn(`[CAPTCHA RATE LIMIT] IP ${req.ip} exceeded limit (${max}/${windowMs}min)`);
        
        return res.status(429).json({
            success: false,
            message: `Too many captcha requests. Maximum ${max} requests per ${windowMs} minute(s). Please slow down.`,
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000) - Math.floor(Date.now() / 1000)
        });
    }
});

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
    addRateLimitHeaders,
    captchaLimiter
};