// services/captcha.service.js
const svgCaptcha = require('svg-captcha');
const { v4: uuidv4 } = require('uuid');
const { getRedisClient } = require('../config/redis');
const HashUtil = require('../utils/hash.util');
require('dotenv').config();

class CaptchaService {
    constructor() {
        this.captchaTTL = parseInt(process.env.CAPTCHA_TTL) || 120;
        this.maxFailures = parseInt(process.env.MAX_CAPTCHA_FAILURES) || 5;
        this.ipBlockTime = parseInt(process.env.IP_BLOCK_TIME) || 600;
    }

    /**
     * Generate new captcha
     * @returns {Promise<{captchaId: string, image: string}>}
     */
    async generateCaptcha() {
        try {
            const redis = await getRedisClient();
            
            // Create captcha with security options
            const captcha = svgCaptcha.create({
                size: 6,
                ignoreChars: '0o1iIlL', // Confusing characters excluded
                noise: 3,
                color: true,
                background: '#f0f0f0',
                width: 150,
                height: 50,
                fontSize: 45,
                charPreset: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789' // Exclude confusing chars
            });



console.log('========== CAPTCHA TEXT FOR TESTING ==========');
console.log('Captcha text:', captcha.text);  // REMOVE THIS IN PRODUCTION!
console.log('==============================================');




            // Generate unique ID for this captcha
            const captchaId = uuidv4();
            
            // Hash the captcha text before storing
            const hashedText = HashUtil.sha256(captcha.text);
            
            // Store in Redis with TTL
            await redis.setEx(
                `captcha:${captchaId}`,
                this.captchaTTL,
                hashedText
            );

            // Log without exposing the captcha text
            console.log(`Captcha generated: ${captchaId} (TTL: ${this.captchaTTL}s)`);

            return {
                captchaId,
                image: captcha.data
            };
        } catch (error) {
            console.error('Captcha generation failed:', error);
            throw new Error('Failed to generate captcha');
        }
    }

    /**
     * Verify captcha input
     * @param {string} captchaId - Captcha identifier
     * @param {string} userInput - User's captcha input
     * @returns {Promise<boolean>} True if valid
     */
    async verifyCaptcha(captchaId, userInput) {
        if (!captchaId || !userInput) {
            return false;
        }

        try {
            const redis = await getRedisClient();
            const key = `captcha:${captchaId}`;

            // Get stored hash
            const storedHash = await redis.get(key);
            
            if (!storedHash) {
                console.log(`Captcha verification failed: ${captchaId} not found or expired`);
                return false;
            }

            // Verify using constant-time comparison
            const isValid = HashUtil.compare(userInput, storedHash);

            // One-time usage: delete immediately after verification attempt
            await redis.del(key);

            if (isValid) {
                console.log(`Captcha verified successfully: ${captchaId}`);
            } else {
                console.log(`Captcha verification failed: ${captchaId} - invalid input`);
            }

            return isValid;
        } catch (error) {
            console.error('Captcha verification error:', error);
            return false; // Fail securely
        }
    }

    /**
     * Increment failure counter for IP
     * @param {string} ip - Client IP address
     * @returns {Promise<{blocked: boolean, failures: number}>}
     */
    async incrementFailure(ip) {
        try {
            const redis = await getRedisClient();
            const key = `login_fail:${ip}`;
            
            // Increment failure count
            const failures = await redis.incr(key);
            
            // Set expiry on first increment
            if (failures === 1) {
                await redis.expire(key, this.ipBlockTime);
            }

            // Check if block threshold reached
            const blocked = failures >= this.maxFailures;

            if (blocked) {
                console.warn(`IP ${ip} blocked for ${this.ipBlockTime}s after ${failures} failures`);
                
                // Extend expiry to ensure block duration
                await redis.expire(key, this.ipBlockTime);
            }

            return { blocked, failures };
        } catch (error) {
            console.error('Failed to increment failure counter:', error);
            return { blocked: false, failures: 0 }; // Fail open but log
        }
    }

    /**
     * Check if IP is blocked
     * @param {string} ip - Client IP address
     * @returns {Promise<boolean>} True if blocked
     */
    async isIpBlocked(ip) {
        try {
            const redis = await getRedisClient();
            const failures = await redis.get(`login_fail:${ip}`);
            
            if (!failures) {
                return false;
            }

            const failureCount = parseInt(failures, 10);
            const blocked = failureCount >= this.maxFailures;
            
            if (blocked) {
                const ttl = await redis.ttl(`login_fail:${ip}`);
                console.log(`IP ${ip} is blocked for ${ttl}s (failures: ${failureCount})`);
            }
            
            return blocked;
        } catch (error) {
            console.error('Failed to check IP block status:', error);
            return false; // Fail open but log
        }
    }

    /**
     * Reset failure counter for IP (on successful login)
     * @param {string} ip - Client IP address
     */
    async resetFailures(ip) {
        try {
            const redis = await getRedisClient();
            await redis.del(`login_fail:${ip}`);
            console.log(`Reset failure counter for IP ${ip}`);
        } catch (error) {
            console.error('Failed to reset failure counter:', error);
        }
    }

    /**
     * Clean up expired captchas (optional - Redis handles automatically with TTL)
     */
    async cleanupExpired() {
        // Redis automatically removes expired keys
        // This method exists for logging/monitoring
        console.log('Redis TTL handles automatic cleanup');
    }
}

module.exports = new CaptchaService();
