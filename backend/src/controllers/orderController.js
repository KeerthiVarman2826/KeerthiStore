const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

const customerFields = ['name', 'email', 'phone', 'address', 'city', 'state', 'pinCode'];

const restoreStock = async (reservations) => {
  const failures = [];

  for (const reservation of [...reservations].reverse()) {
    try {
      const result = await Product.updateOne(
        { _id: reservation.productId },
        { $inc: { stock: reservation.quantity } }
      );
      if (result.matchedCount !== 1) {
        failures.push(`Product ${reservation.productId} no longer exists.`);
      }
    } catch (error) {
      failures.push(`Could not restore stock for product ${reservation.productId}: ${error.message}`);
    }
  }

  return failures;
};

const removeOrder = async (orderId) => {
  try {
    await Order.deleteOne({ _id: orderId });
    return !(await Order.exists({ _id: orderId }));
  } catch (error) {
    console.error('Unable to remove incomplete order during checkout recovery:', error);
    return false;
  }
};

const createOrder = async (req, res) => {
  const submittedDetails = req.body?.customerDetails;
  if (!submittedDetails || typeof submittedDetails !== 'object' || Array.isArray(submittedDetails)) {
    return res.status(400).json({ message: 'Customer delivery details are required.' });
  }

  const customerDetails = {};
  for (const field of customerFields) {
    const value = submittedDetails[field];
    if (typeof value !== 'string' || !value.trim()) {
      return res.status(400).json({ message: `${field} is required.` });
    }
    customerDetails[field] = value.trim();
  }
  customerDetails.email = customerDetails.email.toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerDetails.email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (customerDetails.phone.length < 7 || customerDetails.phone.length > 30) {
    return res.status(400).json({ message: 'Enter a valid phone number.' });
  }
  if (customerDetails.pinCode.length < 3 || customerDetails.pinCode.length > 20) {
    return res.status(400).json({ message: 'Enter a valid PIN code.' });
  }

  let cart;
  let orderId;
  let cartClearAttempted = false;
  const reservations = [];

  try {
    cart = await Cart.findOne({ user: req.userId });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty.' });
    }

    const orderProducts = [];
    let totalAmount = 0;

    for (const cartItem of cart.items) {
      const product = await Product.findById(cartItem.product).lean();
      if (!product) {
        const error = new Error('A product in your cart is no longer available.');
        error.status = 409;
        throw error;
      }

      const reservation = await Product.updateOne(
        {
          _id: product._id,
          price: product.price,
          stock: { $gte: cartItem.quantity },
        },
        { $inc: { stock: -cartItem.quantity } },
        { runValidators: true }
      );
      if (reservation.modifiedCount !== 1) {
        const message = `${product.name} changed or does not have enough stock. Please review your cart.`;
        const rollbackFailures = await restoreStock(reservations);
        if (rollbackFailures.length) {
          console.error('Unable to restore stock after checkout conflict:', rollbackFailures);
          return res.status(500).json({
            message: 'Checkout could not be completed and stock recovery needs attention. Please contact support.',
          });
        }
        return res.status(409).json({ message });
      }

      reservations.push({ productId: product._id, quantity: cartItem.quantity });
      const lineTotal = Math.round(product.price * cartItem.quantity * 100) / 100;
      totalAmount += lineTotal;
      orderProducts.push({
        product: product._id,
        name: product.name,
        image: product.image || 'images/product-placeholder.svg',
        price: product.price,
        quantity: cartItem.quantity,
      });
    }

    totalAmount = Math.round(totalAmount * 100) / 100;
    orderId = new mongoose.Types.ObjectId();
    const order = new Order({
      _id: orderId,
      user: req.userId,
      customerDetails,
      products: orderProducts,
      totalAmount,
    });
    await order.save();

    const clearCartFilter = { _id: cart._id };
    if (typeof cart.__v === 'number') {
      clearCartFilter.__v = cart.__v;
    }
    cartClearAttempted = true;
    const clearCartResult = await Cart.updateOne(
      clearCartFilter,
      { $set: { items: [] }, $inc: { __v: 1 } }
    );
    if (clearCartResult.modifiedCount !== 1) {
      const error = new Error('Your cart changed during checkout. Please review it and try again.');
      error.status = 409;
      throw error;
    }

    return res.status(201).json({ message: 'Order placed successfully.', order });
  } catch (error) {
    let recoveryFailures = [];
    const orderRemoved = !orderId || await removeOrder(orderId);
    if (orderRemoved) {
      recoveryFailures = await restoreStock(reservations);
    }

    if (orderRemoved && cartClearAttempted && cart) {
      const cartVersion = cart.__v ?? 0;
      try {
        const restoreCartResult = await Cart.updateOne(
          { _id: cart._id, __v: cartVersion + 1, items: { $size: 0 } },
          {
            $set: {
              items: cart.items.map((item) => ({
                product: item.product,
                quantity: item.quantity,
              })),
            },
            $inc: { __v: 1 },
          }
        );
        if (restoreCartResult.modifiedCount !== 1) {
          const currentCart = await Cart.findById(cart._id).lean();
          if (!currentCart || currentCart.items.length === 0) {
            recoveryFailures.push('Could not restore the cart after an interrupted checkout.');
          }
        }
      } catch (restoreError) {
        recoveryFailures.push(`Could not restore the cart: ${restoreError.message}`);
      }
    }

    if (recoveryFailures.length) {
      console.error('Checkout recovery was incomplete:', recoveryFailures, error);
      return res.status(500).json({
        message: 'Checkout could not be completed and automatic recovery needs attention. Please contact support.',
      });
    }

    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }

    console.error('Unable to place order:', error);
    return res.status(500).json({
      message: orderRemoved
        ? 'Unable to place your order. Any reserved stock was restored; please try again.'
        : 'Checkout may have completed, but automatic recovery could not confirm it. Check your order history before retrying.',
    });
  }
};

const listMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.userId }).sort({ createdAt: -1 }).lean();
    return res.json({ orders });
  } catch (error) {
    console.error('Unable to load order history:', error);
    return res.status(500).json({ message: 'Unable to load your orders.' });
  }
};

const getOrder = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid order ID.' });
  }

  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) {
      return res.status(404).json({ message: 'Order was not found.' });
    }

    if (order.user.toString() !== req.userId) {
      const user = await User.findById(req.userId).select('role');
      if (user?.role !== 'admin') {
        return res.status(404).json({ message: 'Order was not found.' });
      }
    }

    return res.json({ order });
  } catch (error) {
    console.error('Unable to load order:', error);
    return res.status(500).json({ message: 'Unable to load order details.' });
  }
};

const listAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ orders });
  } catch (error) {
    console.error('Unable to load all orders:', error);
    return res.status(500).json({ message: 'Unable to load orders.' });
  }
};

const updateOrderStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid order ID.' });
  }

  const orderStatus = req.body?.orderStatus;
  const allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!allowedStatuses.includes(orderStatus)) {
    return res.status(400).json({ message: 'Choose a valid order status.' });
  }

  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus },
      { returnDocument: 'after', runValidators: true }
    );
    if (!order) {
      return res.status(404).json({ message: 'Order was not found.' });
    }
    return res.json({ message: 'Order status updated.', order });
  } catch (error) {
    console.error('Unable to update order status:', error);
    return res.status(500).json({ message: 'Unable to update order status.' });
  }
};

module.exports = {
  createOrder,
  listMyOrders,
  getOrder,
  listAllOrders,
  updateOrderStatus,
};
