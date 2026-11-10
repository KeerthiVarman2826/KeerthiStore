const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const formatCart = (cart) => {
  const items = (cart?.items || [])
    .filter((item) => item.product)
    .map((item) => ({
      product: {
        id: item.product._id,
        _id: item.product._id,
        name: item.product.name,
        image: item.product.image || 'images/product-placeholder.svg',
        price: item.product.price,
        stock: item.product.stock,
        category: item.product.category,
      },
      quantity: item.quantity,
      lineTotal: Math.round(item.product.price * item.quantity * 100) / 100,
    }));

  return {
    items,
    subtotal: Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100,
  };
};

const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.userId })
      .populate('items.product', 'name image price stock category');
    return res.json({ cart: formatCart(cart) });
  } catch (error) {
    console.error('Unable to load cart:', error);
    return res.status(500).json({ message: 'Unable to load your cart.' });
  }
};

const addItem = async (req, res) => {
  const { productId, quantity = 1 } = req.body || {};
  if (typeof productId !== 'string' || !mongoose.isValidObjectId(productId) || !Number.isSafeInteger(quantity) || quantity < 1) {
    return res.status(400).json({ message: 'Provide a valid product ID and positive whole-number quantity.' });
  }

  try {
    const product = await Product.findById(productId).select('stock');
    if (!product) {
      return res.status(404).json({ message: 'Product was not found.' });
    }

    const cart = await Cart.findOneAndUpdate(
      { user: req.userId },
      { $setOnInsert: { user: req.userId, items: [] } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );
    const item = cart.items.find((entry) => entry.product.toString() === productId);
    const nextQuantity = (item?.quantity || 0) + quantity;

    if (nextQuantity > product.stock) {
      return res.status(409).json({ message: `Only ${product.stock} item(s) are currently in stock.` });
    }

    if (item) {
      item.quantity = nextQuantity;
    } else {
      cart.items.push({ product: product._id, quantity });
    }

    await cart.save();
    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name image price stock category');
    return res.json({ message: 'Cart updated.', cart: formatCart(populatedCart) });
  } catch (error) {
    if (error.name === 'VersionError') {
      return res.status(409).json({ message: 'Your cart changed at the same time. Please refresh and try again.' });
    }
    console.error('Unable to add product to cart:', error);
    return res.status(500).json({ message: 'Unable to update your cart.' });
  }
};

const updateItem = async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body || {};
  if (!mongoose.isValidObjectId(productId) || !Number.isSafeInteger(quantity) || quantity < 1) {
    return res.status(400).json({ message: 'Provide a valid product ID and positive whole-number quantity.' });
  }

  try {
    const product = await Product.findById(productId).select('stock');
    if (!product) {
      return res.status(404).json({ message: 'Product is no longer available.' });
    }
    if (quantity > product.stock) {
      return res.status(409).json({ message: `Only ${product.stock} item(s) are currently in stock.` });
    }

    const cart = await Cart.findOne({ user: req.userId });
    const item = cart?.items.find((entry) => entry.product.toString() === productId);
    if (!cart || !item) {
      return res.status(404).json({ message: 'Product is not in your cart.' });
    }
    item.quantity = quantity;
    await cart.save();

    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name image price stock category');
    return res.json({ message: 'Cart updated.', cart: formatCart(populatedCart) });
  } catch (error) {
    if (error.name === 'VersionError') {
      return res.status(409).json({ message: 'Your cart changed at the same time. Please refresh and try again.' });
    }
    console.error('Unable to update cart item:', error);
    return res.status(500).json({ message: 'Unable to update your cart.' });
  }
};

const removeItem = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.productId)) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }

  try {
    const cart = await Cart.findOne({ user: req.userId });
    if (!cart) {
      return res.status(404).json({ message: 'Your cart is empty.' });
    }
    cart.items = cart.items.filter((item) => item.product.toString() !== req.params.productId);
    await cart.save();

    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name image price stock category');
    return res.json({ message: 'Product removed from cart.', cart: formatCart(populatedCart) });
  } catch (error) {
    if (error.name === 'VersionError') {
      return res.status(409).json({ message: 'Your cart changed at the same time. Please refresh and try again.' });
    }
    console.error('Unable to remove cart item:', error);
    return res.status(500).json({ message: 'Unable to update your cart.' });
  }
};

const clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { user: req.userId },
      { $set: { items: [] }, $inc: { __v: 1 } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    return res.json({ message: 'Cart cleared.', cart: { items: [], subtotal: 0 } });
  } catch (error) {
    console.error('Unable to clear cart:', error);
    return res.status(500).json({ message: 'Unable to clear your cart.' });
  }
};

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
