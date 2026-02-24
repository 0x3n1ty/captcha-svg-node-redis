// src/config/redis.js
const redis = require('redis');
require('dotenv').config();

let redisClient = null;

/**
 * Create and configure Redis client with secure settings
 * Singleton pattern ensures single connection pool
 */
const createRedisClient = async () => {
    if (redisClient && redisClient.isReady) {
        return redisClient;
    }

    // Close existing connection if any
    if (redisClient) {
        try {
            await redisClient.quit();
        } catch (err) {
            // Ignore errors on quit
        }
        redisClient = null;
    }

    const client = redis.createClient({
        socket: {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            reconnectStrategy: (retries) => {
                // Exponential backoff with max delay of 30 seconds
                const delay = Math.min(Math.pow(2, retries) * 100, 30000);
                console.log(`[REDIS] Reconnecting in ${delay}ms (attempt ${retries})`);
                return delay;
            },
            connectTimeout: 10000 // 10 seconds timeout
        },
        password: process.env.REDIS_PASSWORD,
        // Disable offline queue in production to fail fast
        enableOfflineQueue: process.env.NODE_ENV !== 'production'
    });

    // Error handling
    client.on('error', (err) => {
        console.error('[REDIS] Client Error:', err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error('[REDIS] CRITICAL: Redis server is not accessible - check if Redis is running');
        }
    });

    client.on('connect', () => {
        console.log('[REDIS] Client connected successfully');
    });

    client.on('ready', () => {
        console.log('[REDIS] Client ready for commands');
    });

    client.on('end', () => {
        console.log('[REDIS] Connection closed');
    });

    // Connect with timeout
    try {
        await client.connect();
        
        // Test the connection
        await client.ping();
        console.log('[REDIS] Connection verified');
        
        redisClient = client;
        return redisClient;
    } catch (err) {
        console.error('[REDIS] Failed to connect:', err.message);
        throw new Error(`Redis connection failed: ${err.message}`);
    }
};

/**
 * Get Redis client instance
 */
const getRedisClient = async () => {
    if (!redisClient || !redisClient.isReady) {
        redisClient = await createRedisClient();
    }
    return redisClient;
};

/**
 * Graceful shutdown
 */
const closeRedisConnection = async () => {
    if (redisClient) {
        try {
            await redisClient.quit();
            console.log('[REDIS] Connection closed gracefully');
        } catch (err) {
            console.error('[REDIS] Error during shutdown:', err.message);
        } finally {
            redisClient = null;
        }
    }
};

// Handle application termination
process.on('SIGINT', async () => {
    console.log('[APP] Received SIGINT signal');
    await closeRedisConnection();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('[APP] Received SIGTERM signal');
    await closeRedisConnection();
    process.exit(0);
});

module.exports = {
    getRedisClient,
    createRedisClient,
    closeRedisConnection
};
