const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isSafeInteger,
      message: 'Quantity must be a whole number.',
    },
  },
}, { _id: false });

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  items: {
    type: [cartItemSchema],
    default: [],
  },
}, {
  timestamps: true,
  optimisticConcurrency: true,
});

module.exports = mongoose.model('Cart', cartSchema);
