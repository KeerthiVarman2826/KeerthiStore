const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not set in the environment.');
    }

    const options = process.env.MONGO_REPLICA_SET
      ? { replicaSet: process.env.MONGO_REPLICA_SET }
      : {};

    await mongoose.connect(process.env.MONGO_URI, options);
    console.log('MongoDB Connected Successfully!');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
};

module.exports = connectDB;