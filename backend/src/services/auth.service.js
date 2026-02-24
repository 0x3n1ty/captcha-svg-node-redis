// src/services/auth.service.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/user.repository');
const captchaService = require('./captcha.service');

class AuthService {
    /**
     * Authenticate user with credentials and captcha
     */
    async authenticate(username, password, captcha, captchaId, ip) {
        try {
            // Step 1: Check if IP is blocked
            const isBlocked = await captchaService.isIpBlocked(ip);
            if (isBlocked) {
                return {
                    success: false,
                    blocked: true,
                    message: 'Too many failed attempts. IP blocked.'
                };
            }

            // Step 2: Validate captcha
            const isValidCaptcha = await captchaService.verifyCaptcha(captchaId, captcha);
            if (!isValidCaptcha) {
                await captchaService.incrementFailure(ip);
                return {
                    success: false,
                    message: 'Invalid captcha'
                };
            }

            // Step 3: Find user (using repository)
            console.log(`[AuthService] Looking for user: ${username}`);
            const user = await userRepository.findByUsername(username);
            
            if (!user) {
                console.log(`[AuthService] User not found: ${username}`);
                await captchaService.incrementFailure(ip);
                return {
                    success: false,
                    message: 'Invalid username or password'
                };
            }

            console.log(`[AuthService] User found: ${username}, verifying password...`);
// Temporary debug code - REMOVE AFTER TESTING
console.log('Password from request:', password);
console.log('Stored hash:', user.password);
console.log('Bcrypt compare result:', await bcrypt.compare(password, user.password));

            // Step 4: Verify password
            const isValidPassword = await bcrypt.compare(password, user.password);
            console.log(`[AuthService] Password valid: ${isValidPassword}`);
            
            if (!isValidPassword) {
                await captchaService.incrementFailure(ip);
                return {
                    success: false,
                    message: 'Invalid username or password'
                };
            }

            // Step 5: Success - generate token and update last login
            await captchaService.resetFailures(ip);
            await userRepository.updateLastLogin(user.id);

            // Make sure JWT_SECRET is set in .env
            if (!process.env.JWT_SECRET) {
                console.error('[AuthService] JWT_SECRET not set in environment');
                throw new Error('JWT configuration error');
            }

            const token = jwt.sign(
                { 
                    userId: user.id, 
                    username: user.username,
                    role: user.role 
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRY || '24h' }
            );

            // Return user without sensitive data
            const { password: _, ...userWithoutPassword } = user;
            
            return {
                success: true,
                token,
                user: userWithoutPassword
            };

        } catch (error) {
            console.error('[AuthService] Authentication error:', error);
            // Don't increment failure counter for server errors
            throw error;
        }
    }

    /**
     * Register new user
     */
    async register(userData) {
        try {
            const { username, password, email } = userData;

            // Check if user exists
            const existingUser = await userRepository.findByUsername(username);
            if (existingUser) {
                throw new Error('Username already exists');
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            const newUser = await userRepository.create({
                username,
                password: hashedPassword,
                email,
                role: 'user'
            });

            const { password: _, ...userWithoutPassword } = newUser;
            return userWithoutPassword;
        } catch (error) {
            console.error('[AuthService] Registration error:', error);
            throw error;
        }
    }

    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            if (!process.env.JWT_SECRET) {
                console.error('[AuthService] JWT_SECRET not set');
                return null;
            }
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            console.error('[AuthService] Token verification failed:', error);
            return null;
        }
    }
}

module.exports = new AuthService();
