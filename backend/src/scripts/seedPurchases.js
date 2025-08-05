/**
 * Generates 50 weekly baskets per user, each linked to a REAL
 * shopping-list ID, and injects 1–3 items from that list into
 * the basket to guarantee overlap for co-occurrence.
 */

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

  // Only products with a non-empty name
  const products = await Product.find({
    name: { $exists: true, $type: 'string', $nin: ['', ' '] }
  });

  // Load lists with members + product codes
  const lists = await List.find(
    {},
    '_id members products.product.itemCode'
  ).lean();

  if (!users.length || !products.length || !lists.length) {
    console.error('❌ Seed users, products, and lists first.');
    return process.exit(1);
  }

  // Fast lookup maps
  const productMap = new Map(products.map(p => [p._id.toString(), p]));
  const listMap    = new Map(lists.map(l => [l._id.toString(), l]));

  // userId -> [listIds]
  const userListsMap = {};
  lists.forEach(l =>
    l.members.forEach(uid => {
      const k = uid.toString();
      (userListsMap[k] ||= []).push(l._id);
    })
  );

  /* 2) Generate baskets */
  const purchases      = [];
  const basketsPerUser = 50;
  const now            = new Date();

  for (const user of users) {
    const eligibleLists = userListsMap[user._id.toString()] || [];
    if (!eligibleLists.length) continue; // user has no lists

    // Draw 1–3 habit items for this user
    const habitItems = faker.helpers
      .shuffle(products)
      .slice(0, faker.number.int({ min: 1, max: 3 }));

    for (let b = 0; b < basketsPerUser; b++) {
      /*  basket date: b weeks ago with ±1-day jitter */
      const date = new Date(now);
      date.setDate(
        now.getDate() - b * 7 + faker.number.int({ min: -1, max: 1 })
      );
      if (date > now) date.setTime(now.getTime()); // clamp future -> now

      /* random items 5–15 */
      const basketProds = faker.helpers
        .shuffle(products)
        .slice(0, faker.number.int({ min: 5, max: 15 }));

      /* inject habit items if missing  */
      habitItems.forEach(h => {
        const exists = basketProds.some(
          p => p._id.toString() === h._id.toString()
        );
        if (!exists) basketProds.push(h);
      });

      /* pick one of the user’s lists */
      const listId  = faker.helpers.arrayElement(eligibleLists);
      const listDoc = listMap.get(listId.toString());

      /* ensure overlap with the chosen list: inject 1–3 list items */
      const listItemCodes = (listDoc?.products || [])
        .map(li => li.product?.itemCode?.toString())
        .filter(Boolean);

      if (listItemCodes.length) {
        const injectCount = Math.min(
          faker.number.int({ min: 1, max: 3 }),
          listItemCodes.length
        );
        const injectCodes = faker.helpers.arrayElements(listItemCodes, injectCount);

        injectCodes.forEach(code => {
          const exists = basketProds.some(p => p._id.toString() === code);
          if (!exists) {
            const prod = productMap.get(code);
            if (prod) basketProds.push(prod);
          }
        });
      }

      /* ✅ NEW: snapshot current members of the list */
      const membersSnapshot = (listDoc?.members || []).map(m => m);

      /* build purchase doc */
      purchases.push({
        listId,
        timeStamp:   date,
        purchasedBy: user._id,
        membersSnapshot, // ✅ store who were members at purchase time
        products:    basketProds
          .filter(p => p?.name && p.name.trim().length)
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
