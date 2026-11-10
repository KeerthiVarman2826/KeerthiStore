require('dotenv').config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

const createAdmin = async () => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'KeerthiStore Admin';

  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script.');
  }

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters long.');
  }

  await connectDB();

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: { role: 'admin', password: passwordHash },
      $setOnInsert: {
        email,
        name,
      },
    },
    {
      returnDocument: 'after',
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log(`Administrator role is ready for ${user.email}.`);
};

createAdmin()
  .catch((error) => {
    console.error('Could not provision administrator:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
