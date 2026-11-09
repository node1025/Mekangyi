const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/', authMiddleware, wishlistController.getWishlist);
router.get('/status/:productId', authMiddleware, wishlistController.getWishStatus);
router.post('/toggle', authMiddleware, wishlistController.toggleWishlist);
router.delete('/:productId', authMiddleware, wishlistController.removeFromWishlist);

module.exports = router;
