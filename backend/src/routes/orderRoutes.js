const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const {
  createOrder,
  listMyOrders,
  getOrder,
  listAllOrders,
  updateOrderStatus,
} = require('../controllers/orderController');

const router = express.Router();

router.use(authMiddleware);
router.post('/', createOrder);
router.get('/', adminMiddleware, listAllOrders);
router.get('/my-orders', listMyOrders);
router.put('/:id/status', adminMiddleware, updateOrderStatus);
router.get('/:id', getOrder);

module.exports = router;
