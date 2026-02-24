// utils/hash.util.js
const crypto = require('crypto');

/**
 * Secure hash utilities for captcha validation
 * Never store plaintext captcha values
 */
class HashUtil {
    /**
     * Generate SHA256 hash of input string
     * @param {string} text - Text to hash
     * @returns {string} Hex encoded hash
     */
    static sha256(text) {
        if (!text || typeof text !== 'string') {
            throw new Error('Invalid input for hashing');
        }
        
        // Normalize: lowercase and trim whitespace
        const normalized = text.toLowerCase().trim();
        
        // Generate hash
        return crypto
            .createHash('sha256')
            .update(normalized, 'utf8')
            .digest('hex');
    }

    /**
     * Securely compare hash with input text
     * @param {string} inputText - User input captcha
     * @param {string} storedHash - Hash from Redis
     * @returns {boolean} True if matches
     */
    static compare(inputText, storedHash) {
        if (!inputText || !storedHash) {
            return false;
        }

        const inputHash = this.sha256(inputText);
        
        // Constant-time comparison to prevent timing attacks
        return crypto.timingSafeEqual(
            Buffer.from(inputHash, 'hex'),
            Buffer.from(storedHash, 'hex')
        );
    }

    /**
     * Generate random string for additional entropy
     * @param {number} length - Length of random string
     * @returns {string} Random string
     */
    static generateRandomSalt(length = 8) {
        return crypto.randomBytes(length).toString('hex');
    }
}

module.exports = HashUtil;
