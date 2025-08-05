const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');

const Purchase = require('../models/purchaseModel');
const User     = require('../models/userModel');
const Product  = require('../models/productModel');
const List     = require('../models/shoppingListModel');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const users = await User.find();

  const products = await Product.find({
    name: { $exists: true, $type: 'string', $nin: ['', ' '] }
  });

  const lists = await List.find({}, '_id members').lean();

  if (!users.length || !products.length || !lists.length) {
    console.error('❌ Seed users, products, and lists first.');
    return process.exit(1);
  }

  const userListsMap = {};
  lists.forEach(l =>
    l.members.forEach(uid => {
      const k = uid.toString();
      userListsMap[k] = userListsMap[k] || [];
      userListsMap[k].push(l._id);
    })
  );

  const purchases      = [];
  const basketsPerUser = 50;
  const now            = new Date();

  for (const user of users) {
    const eligibleLists = userListsMap[user._id.toString()] || [];
    if (!eligibleLists.length) continue;               // user has no lists

    // draw 1–3 habit items
    const habitItems = faker.helpers
      .shuffle(products)
      .slice(0, faker.number.int({ min: 1, max: 3 }));

    for (let b = 0; b < basketsPerUser; b++) {
      /* basket date */
      const date = new Date(now);
      date.setDate(
        now.getDate() - b * 7 + faker.number.int({ min: -1, max: 1 })
      );
      if (date > now) date.setTime(now.getTime());

      /* random items 5–15 */
      const basketProds = faker.helpers
        .shuffle(products)
        .slice(0, faker.number.int({ min: 5, max: 15 }));

      /* inject habit items if missing */
      habitItems.forEach(h => {
        const exists = basketProds.some(
          p => p._id.toString() === h._id.toString()
        );
        if (!exists) basketProds.push(h);
      });

      const listId = faker.helpers.arrayElement(eligibleLists);


      purchases.push({
        listId,
        timeStamp:   date,
        purchasedBy: user._id,
        products:    basketProds
          .filter(p => p.name && p.name.trim().length)
          .map(p => ({
            product: {
              itemCode: p._id,
              name:     p.name,
              image:    p.image || ''
            },
            numUnits: faker.number.int({ min: 1, max: 4 })
          }))
      });
    }
  }

  await Purchase.deleteMany({});
  await Purchase.insertMany(purchases);
  console.log(`✅ Inserted ${purchases.length} purchases.`);
  process.exit(0);
})();
