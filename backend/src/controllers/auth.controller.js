// src/controllers/auth.controller.js
const authService = require('../services/auth.service');

class AuthController {
    /**
     * POST /api/login
     */
    async login(req, res) {
        try {
            const { username, password, captcha, captchaId } = req.body;
            const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

            console.log(`[AuthController] Login attempt for user: ${username} from IP: ${ip}`);

            // Validate required fields
            if (!username || !password || !captcha || !captchaId) {
                return res.status(400).json({
                    success: false,
                    message: 'All fields are required'
                });
            }

            const result = await authService.authenticate(
                username, 
                password, 
                captcha, 
                captchaId, 
                ip
            );

            if (!result.success) {
                const statusCode = result.blocked ? 429 : 400;
                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            console.log(`[AuthController] Login successful for user: ${username}`);
            
            return res.status(200).json({
                success: true,
                message: 'Login successful',
                token: result.token,
                user: result.user
            });

        } catch (error) {
            console.error('[AuthController] Login error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error during login'
            });
        }
    }

    /**
     * POST /api/register
     */
    async register(req, res) {
        try {
            const { username, password, email } = req.body;

            // Validate input
            if (!username || !password || !email) {
                return res.status(400).json({
                    success: false,
                    message: 'All fields are required'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 6 characters'
                });
            }

            const user = await authService.register({ username, password, email });

            return res.status(201).json({
                success: true,
                message: 'User registered successfully',
                user
            });

        } catch (error) {
            if (error.message === 'Username already exists') {
                return res.status(409).json({
                    success: false,
                    message: error.message
                });
            }

            console.error('[AuthController] Register error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    /**
     * GET /api/verify-token
     */
    verifyToken(req, res) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    success: false,
                    message: 'No token provided'
                });
            }

            const token = authHeader.split(' ')[1];
            const decoded = authService.verifyToken(token);
            
            if (!decoded) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid or expired token'
                });
            }

            return res.status(200).json({
                success: true,
                user: decoded
            });
        } catch (error) {
            console.error('[AuthController] Token verification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Error verifying token'
            });
        }
    }
}

module.exports = new AuthController();
