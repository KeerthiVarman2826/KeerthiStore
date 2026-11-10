const mongoose = require('mongoose');

const customerDetailsSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  address: { type: String, required: true, trim: true, maxlength: 300 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, required: true, trim: true, maxlength: 100 },
  pinCode: { type: String, required: true, trim: true, maxlength: 20 },
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: { type: String, required: true },
  image: { type: String, default: 'images/product-placeholder.svg' },
  price: { type: Number, required: true, min: 0 },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isSafeInteger,
      message: 'Quantity must be a positive whole number.',
    },
  },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  customerDetails: {
    type: customerDetailsSchema,
    required: true,
  },
  products: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator: (products) => products.length > 0,
      message: 'An order must contain at least one product.',
    },
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
    required: true,
  },
}, {
  timestamps: true,
});

orderSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
