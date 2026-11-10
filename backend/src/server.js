require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('KeerthiStore backend is running!');
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

app.use((err, req, res, next) => {
  console.error('Request error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  server.on('error', (error) => {
    console.error('Server failed to start:', error.message);
    process.exitCode = 1;
  });
};

startServer().catch((error) => {
  console.error('Backend startup failed:', error.message);
  process.exitCode = 1;
});