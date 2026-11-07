const router = require('express').Router();
const { authMiddleware, isAdmin } = require('../middleware/authMiddleware');
const sessions = require('../services/adminSession');
const limit = require('../middleware/loginRateLimit').createLoginRateLimit();
router.post('/session', authMiddleware, limit, sessions.create);
router.get('/session', authMiddleware, isAdmin, sessions.inspect);
router.delete('/session', authMiddleware, sessions.destroy);
module.exports = router;
