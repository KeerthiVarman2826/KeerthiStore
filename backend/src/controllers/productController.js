const mongoose = require('mongoose');
const Product = require('../models/Product');

const productFields = ['name', 'description', 'price', 'image', 'category', 'stock'];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const validateImage = (image) => {
  if (typeof image !== 'string' || image.length > 500) {
    return false;
  }

  const trimmedImage = image.trim();
  return (
    trimmedImage === '' ||
    trimmedImage.startsWith('images/') ||
    (trimmedImage.startsWith('/') && !trimmedImage.startsWith('//')) ||
    trimmedImage.startsWith('./') ||
    /^https?:\/\/\S+$/i.test(trimmedImage)
  );
};

const listProducts = async (req, res) => {
  const { search = '', category, sort } = req.query;
  if (typeof search !== 'string' || search.length > 100) {
    return res.status(400).json({ message: 'Search text must be at most 100 characters.' });
  }

  if (sort && !['price-asc', 'price-desc', 'newest'].includes(sort)) {
    return res.status(400).json({ message: 'Unsupported product sort option.' });
  }

  try {
    const filter = {};
    if (search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
      ];
    }

    if (typeof category === 'string' && category.trim()) {
      filter.category = new RegExp(`^${escapeRegex(category.trim())}$`, 'i');
    }

    const sortOrder = sort === 'price-asc'
      ? { price: 1, _id: 1 }
      : sort === 'price-desc'
        ? { price: -1, _id: 1 }
        : { createdAt: -1 };

    const [products, categories] = await Promise.all([
      Product.find(filter).sort(sortOrder).lean(),
      Product.distinct('category'),
    ]);

    return res.json({ products, categories });
  } catch (error) {
    console.error('Unable to list products:', error);
    return res.status(500).json({ message: 'Unable to load products.' });
  }
};

const getProduct = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }

  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ message: 'Product was not found.' });
    }

    return res.json({ product });
  } catch (error) {
    console.error('Unable to load product:', error);
    return res.status(500).json({ message: 'Unable to load product.' });
  }
};

const createProduct = async (req, res) => {
  const input = {};
  for (const field of productFields) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
      input[field] = req.body[field];
    }
  }

  if (!validateImage(input.image ?? '')) {
    return res.status(400).json({ message: 'Image must be a local path or an HTTP(S) URL.' });
  }

  try {
    const product = await Product.create(input);
    return res.status(201).json({ message: 'Product created.', product });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Unable to create product:', error);
    return res.status(500).json({ message: 'Unable to create product.' });
  }
};

const updateProduct = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }

  const updates = {};
  for (const field of productFields) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'Provide at least one product field to update.' });
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'image') && !validateImage(updates.image)) {
    return res.status(400).json({ message: 'Image must be a local path or an HTTP(S) URL.' });
  }

  try {
    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!product) {
      return res.status(404).json({ message: 'Product was not found.' });
    }
    return res.json({ message: 'Product updated.', product });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Unable to update product:', error);
    return res.status(500).json({ message: 'Unable to update product.' });
  }
};

const deleteProduct = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid product ID.' });
  }

  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product was not found.' });
    }
    return res.json({ message: 'Product deleted.' });
  } catch (error) {
    console.error('Unable to delete product:', error);
    return res.status(500).json({ message: 'Unable to delete product.' });
  }
};

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};
