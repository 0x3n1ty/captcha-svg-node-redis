// controllers/captcha.controller.js
const captchaService = require('../services/captcha.service');

class CaptchaController {
    /**
     * GET /captcha
     * Generate new captcha
     */
    async generateCaptcha(req, res) {
        try {
            const captcha = await captchaService.generateCaptcha();
            
            // Set security headers
            res.set({
                'Cache-Control': 'no-store, no-cache, must-revalidate, private',
                'Pragma': 'no-cache',
                'Expires': '0',
                'X-Content-Type-Options': 'nosniff'
            });

            return res.status(200).json({
                success: true,
                data: {
                    captchaId: captcha.captchaId,
                    image: captcha.image
                }
            });
        } catch (error) {
            console.error('Generate captcha error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate captcha'
            });
        }
    }

    /**
     * Validate captcha (used internally by login controller)
     * This is not exposed as an endpoint
     */
    async validateCaptcha(captchaId, userInput, ip) {
        // Check if IP is blocked
        const isBlocked = await captchaService.isIpBlocked(ip);
        if (isBlocked) {
            return {
                valid: false,
                blocked: true,
                message: 'Too many failed attempts. Please try again later.'
            };
        }

        // Verify captcha
        const isValid = await captchaService.verifyCaptcha(captchaId, userInput);
        
        if (!isValid) {
            // Increment failure counter
            const { blocked } = await captchaService.incrementFailure(ip);
            
            return {
                valid: false,
                blocked,
                message: 'Invalid captcha'
            };
        }

        // Captcha valid - reset failures (actual login success will handle this separately)
        return {
            valid: true,
            blocked: false,
            message: 'Captcha valid'
        };
    }
}

module.exports = new CaptchaController();
