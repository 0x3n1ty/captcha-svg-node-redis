// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validateLogin } = require('../middleware/validation.middleware');

router.post('/login', validateLogin, (req, res) => authController.login(req, res));
router.post('/register', (req, res) => authController.register(req, res));
router.get('/verify-token', (req, res) => authController.verifyToken(req, res));

module.exports = router;
