require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Product = require('../src/models/Product');

const sampleProducts = [
  {
    name: 'Luma Adjustable LED Desk Lamp',
    description: 'An energy-saving LED desk lamp with adjustable brightness and a flexible neck for reading or focused work.',
    price: 1899,
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85',
    category: 'Electronics',
    stock: 32,
  },
  {
    name: 'Echo Mini Bluetooth Speaker',
    description: 'A compact portable speaker with clear sound, simple wireless pairing, and a rechargeable battery.',
    price: 3499,
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85',
    category: 'Electronics',
    stock: 21,
  },
  {
    name: 'ViewPoint 4K Streaming Display',
    description: 'A sharp 4K home display with vivid colors, slim bezels, and multiple connectivity options.',
    price: 42999,
    image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=900&q=85',
    category: 'Electronics',
    stock: 8,
  },
  {
    name: 'Astra X5 5G Smartphone',
    description: 'A fast 5G smartphone with a bright edge-to-edge display, all-day battery, and versatile cameras.',
    price: 24999,
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=85',
    category: 'Mobiles',
    stock: 17,
  },
  {
    name: 'Nova M20 Android Smartphone',
    description: 'A dependable everyday Android phone with a large display, generous storage, and a long-lasting battery.',
    price: 14999,
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=85',
    category: 'Mobiles',
    stock: 24,
  },
  {
    name: 'PixelPro Dual-SIM Smartphone',
    description: 'A dual-SIM smartphone with smooth performance, crisp photos, and a comfortable lightweight design.',
    price: 18999,
    image: 'https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?auto=format&fit=crop&w=900&q=85',
    category: 'Mobiles',
    stock: 13,
  },
  {
    name: 'WorkMate 14 Everyday Laptop',
    description: 'A portable 14-inch laptop for study and office work, featuring a responsive keyboard and fast solid-state storage.',
    price: 54990,
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85',
    category: 'Laptops',
    stock: 10,
  },
  {
    name: 'Summit 15 Performance Laptop',
    description: 'A practical 15-inch laptop with a spacious display and capable performance for multitasking and everyday projects.',
    price: 72990,
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=85',
    category: 'Laptops',
    stock: 7,
  },
  {
    name: 'CreatorBook 16 Studio Laptop',
    description: 'A high-resolution 16-inch laptop with powerful graphics performance for creative work and media editing.',
    price: 114990,
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=85',
    category: 'Laptops',
    stock: 5,
  },
  {
    name: 'StudioBeat Wireless Headphones',
    description: 'Comfortable over-ear wireless headphones with detailed audio, cushioned ear cups, and convenient on-ear controls.',
    price: 5999,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85',
    category: 'Headphones',
    stock: 19,
  },
  {
    name: 'SoundWave Noise-Cancelling Headphones',
    description: 'Wireless headphones with active noise reduction, soft padding, and a foldable design for travel.',
    price: 8999,
    image: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=900&q=85',
    category: 'Headphones',
    stock: 11,
  },
  {
    name: 'AirFit True Wireless Earbuds',
    description: 'Pocket-sized wireless earbuds with a charging case, touch controls, and a secure fit for daily listening.',
    price: 3299,
    image: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=85',
    category: 'Headphones',
    stock: 28,
  },
  {
    name: 'Heritage Cotton Oxford Shirt',
    description: 'A breathable cotton button-down shirt with a timeless cut for workdays, dinners, and weekend wear.',
    price: 2199,
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=900&q=85',
    category: 'Fashion',
    stock: 26,
  },
  {
    name: 'Everyday Tailored Jacket',
    description: 'A versatile lightweight jacket with a clean silhouette, practical pockets, and comfortable all-season layering.',
    price: 4899,
    image: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=900&q=85',
    category: 'Fashion',
    stock: 14,
  },
  {
    name: 'Stride Lightweight Running Shoes',
    description: 'Cushioned running shoes with a breathable upper and flexible sole for walks, training, and everyday use.',
    price: 3999,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85',
    category: 'Fashion',
    stock: 18,
  },
  {
    name: 'Meridian Classic Analog Watch',
    description: 'A refined analog watch with a clear dial, durable case, and an adjustable strap for daily wear.',
    price: 6999,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85',
    category: 'Accessories',
    stock: 12,
  },
  {
    name: 'Urban Leather Crossbody Bag',
    description: 'A compact crossbody bag with organized compartments and an adjustable strap for hands-free outings.',
    price: 2799,
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=85',
    category: 'Accessories',
    stock: 16,
  },
  {
    name: 'Coastline UV Protection Sunglasses',
    description: 'Lightweight sunglasses with UV-protective lenses and a classic frame suited to everyday outdoor wear.',
    price: 1599,
    image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=85',
    category: 'Accessories',
    stock: 30,
  },
  {
    name: 'CrispAir Digital Air Fryer',
    description: 'A family-size air fryer with digital temperature controls and a removable non-stick basket for easy cleanup.',
    price: 7499,
    image: 'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=900&q=85',
    category: 'Home Appliances',
    stock: 9,
  },
  {
    name: 'Barista Compact Coffee Maker',
    description: 'A countertop coffee maker with simple controls and a compact footprint for fresh coffee at home.',
    price: 5699,
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85',
    category: 'Home Appliances',
    stock: 12,
  },
  {
    name: 'SwiftClean Cordless Vacuum',
    description: 'A lightweight cordless vacuum with easy steering and a rechargeable design for everyday home cleaning.',
    price: 12999,
    image: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=900&q=85',
    category: 'Home Appliances',
    stock: 6,
  },
];

const seedProducts = async () => {
  await connectDB();

  let inserted = 0;
  let alreadyPresent = 0;

  for (const product of sampleProducts) {
    const result = await Product.updateOne(
      { name: product.name },
      { $setOnInsert: product },
      { upsert: true, runValidators: true }
    );

    if (result.upsertedCount === 1) {
      inserted += 1;
    } else {
      alreadyPresent += 1;
    }
  }

  console.log(
    `Product seed complete: inserted ${inserted}; already present ${alreadyPresent} ` +
    `(left unchanged). Seed catalog contains ${sampleProducts.length} products.`
  );
};

seedProducts()
  .catch((error) => {
    console.error('Could not seed sample products:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
