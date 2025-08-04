const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const bcrypt = require('bcrypt');
const User = require('../models/userModel');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  let users = await User.find().limit(100);
  if (users.length < 100) {
    const toCreate = 100 - users.length;
    const bulk = [];
    for (let i = 0; i < toCreate; i++) {
      bulk.push({
        email: faker.internet.email(),
        username: faker.internet.username(),
        passwordHash: await bcrypt.hash('Password@123', 10)
      });
    }
    await User.insertMany(bulk);
    console.log(`Created ${toCreate} users (total now 100).`);
  } else {
    console.log('100+ users already exist – skipping.');
  }
  process.exit(0);
})();
