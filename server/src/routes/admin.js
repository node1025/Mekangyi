const router = require('express').Router();
const { authMiddleware, isAdmin } = require('../middleware/authMiddleware');
const sessions = require('../services/adminSession');
router.post('/session/refresh', authMiddleware, isAdmin, sessions.refresh);
router.post('/session', authMiddleware, sessions.create);
router.get('/session', authMiddleware, isAdmin, sessions.inspect);
router.delete('/session', authMiddleware, sessions.destroy);
module.exports = router;
