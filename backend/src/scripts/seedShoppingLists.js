const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const User = require('../models/userModel');
const Product = require('../models/productModel');
const List = require('../models/shoppingListModel');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const users = await User.find();                  // all users
  const products = await Product.find();              // sample pool
  const lists = [];

  users.forEach(user => {
    for (let i = 0; i < 3; i++) {                   // 3 lists each
      // 1-3 members per list (user + maybe extras)
      const members = [user._id];
      const extras = faker.number.int({ min: 0, max: 2 });
      while (members.length < extras + 1) {
        const randomUid = faker.helpers.arrayElement(users)._id;
        if (!members.includes(randomUid)) members.push(randomUid);
      }

      const picked = faker.helpers.shuffle(products)
                       .slice(0, faker.number.int({ min: 5, max: 10 }));

      lists.push({
        title: faker.lorem.words(2),
        members,
        importantList: faker.datatype.boolean(),
        products: picked.map(p => ({
          product: { itemCode: p._id, name: p.name, image: p.image },
          numUnits: faker.number.int({ min: 1, max: 3 })
        }))
      });
    }
  });

  await List.deleteMany({});
  const res = await List.insertMany(lists);
  console.log(`Seeded ${res.length} shopping lists.`);
  process.exit(0);
})();
