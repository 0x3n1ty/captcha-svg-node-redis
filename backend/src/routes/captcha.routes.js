// routes/captcha.routes.js
const express = require('express');
const router = express.Router();
const captchaController = require('../controllers/captcha.controller');
const { captchaLimiter } = require('../middleware/rateLimit.middleware'); // Import the limiter

/**
 * @route GET /api/captcha
 * @desc Generate new captcha with rate limiting
 * @access Public
 */
router.get('/captcha', captchaLimiter, async (req, res) => {
    await captchaController.generateCaptcha(req, res);
});

/**
 * Note: No POST endpoint for captcha validation
 * Validation is handled internally by login controller
 * This prevents direct captcha validation API abuse
 */

module.exports = router;