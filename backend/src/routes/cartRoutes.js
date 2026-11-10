const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
} = require('../controllers/cartController');

const router = express.Router();

router.use(authMiddleware);
router.get('/', getCart);
router.post('/items', addItem);
router.put('/items/:productId', updateItem);
router.delete('/items/:productId', removeItem);
router.delete('/', clearCart);

module.exports = router;
