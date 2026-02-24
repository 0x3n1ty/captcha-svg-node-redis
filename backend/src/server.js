// src/server.js (update the routes section)
const express = require('express');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { createLoginRateLimiter, addRateLimitHeaders } = require('./middleware/rateLimit.middleware');
const { getRedisClient, closeRedisConnection } = require('./config/redis');
const captchaRoutes = require('./routes/captcha.routes');
const authRoutes = require('./routes/auth.routes'); // Add this line

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Security Middleware
 */

// 1. Helmet for security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// 2. Body parser with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 3. Add security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// 4. Request logging (minimal, no sensitive data)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

/**
 * Routes
 */
app.use('/api', captchaRoutes);
app.use('/api', authRoutes); // Add this line

// Health check endpoint (no rate limiting)
app.get('/health', async (req, res) => {
    try {
        const redis = await getRedisClient();
        await redis.ping();
        res.status(200).json({ 
            status: 'healthy',
            redis: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'degraded',
            redis: 'disconnected',
            error: error.message
        });
    }
});

// Test endpoint (remove in production)
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Server is working!',
        time: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Resource not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[ERROR] Unhandled error:', err);
    
    // Don't leak error details in production
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message;
    
    res.status(err.status || 500).json({
        success: false,
        message: message
    });
});

/**
 * Initialize Redis and start server
 */
const startServer = async () => {
    try {
        // Initialize Redis connection first
        console.log('[SERVER] Connecting to Redis...');
        await getRedisClient();
        
        // Create and apply rate limiter (after Redis is ready)
        console.log('[SERVER] Creating rate limiter...');
        const loginLimiter = await createLoginRateLimiter();
        
        // Apply rate limiter to login route only
        app.use('/api/login', loginLimiter);
        
        // Add rate limit headers middleware (after rate limiter)
        app.use(addRateLimitHeaders);
        
        // Start server
        app.listen(PORT, '127.0.0.1', () => {
            console.log(`[SERVER] Running on http://127.0.0.1:${PORT}`);
            console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`[SERVER] Captcha TTL: ${process.env.CAPTCHA_TTL || 120}s`);
            console.log(`[SERVER] Max failures: ${process.env.MAX_CAPTCHA_FAILURES || 5}`);
            console.log(`[SERVER] IP block time: ${process.env.IP_BLOCK_TIME || 600}s`);
        });
    } catch (error) {
        console.error('[SERVER] Failed to start:', error);
        
        // Start server without Redis (fallback mode)
        console.log('[SERVER] Starting in fallback mode without Redis...');
        
        app.listen(PORT, '127.0.0.1', () => {
            console.log(`[SERVER] Running in FALLBACK mode on http://127.0.0.1:${PORT}`);
            console.log('[SERVER] WARNING: Redis is not available - rate limiting disabled');
        });
    }
};

// Start the server
startServer();
