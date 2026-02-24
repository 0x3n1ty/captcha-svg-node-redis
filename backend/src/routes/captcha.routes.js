// routes/captcha.routes.js
const express = require('express');
const router = express.Router();
const captchaController = require('../controllers/captcha.controller');

/**
 * @route GET /api/captcha
 * @desc Generate new captcha
 * @access Public
 */
router.get('/captcha', async (req, res) => {
    await captchaController.generateCaptcha(req, res);
});

/**
 * Note: No POST endpoint for captcha validation
 * Validation is handled internally by login controller
 * This prevents direct captcha validation API abuse
 */

module.exports = router;
