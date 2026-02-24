// src/middleware/validation.middleware.js
const { body, validationResult } = require('express-validator');

const validateLogin = [
    body('username').notEmpty().trim().escape(),
    body('password').notEmpty(),
    body('captcha').notEmpty().isLength({ min: 4, max: 8 }),
    body('captchaId').notEmpty().isUUID(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }
        next();
    }
];

module.exports = { validateLogin };
