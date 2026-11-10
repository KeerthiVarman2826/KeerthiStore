const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000,
  },
  price: {
    type: Number,
    required: true,
    min: 0.01,
  },
  image: {
    type: String,
    trim: true,
    maxlength: 500,
    default: 'images/product-placeholder.svg',
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
    index: true,
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isSafeInteger,
      message: 'Stock must be a whole number.',
    },
  },
}, {
  timestamps: true,
});

productSchema.index({ name: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);
