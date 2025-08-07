const cron = require('node-cron');
const SystemMeta = require('../models/SystemMeta');
const runPricePipeline = require('../jobs/run-price-pipeline');

// every day at 05:30
cron.schedule('30 5 * * *', async () => {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(5, 30, 0, 0);

  await SystemMeta.findByIdAndUpdate(
    'price-refresh',
    { $set: { nextPlanned: next } },
    { upsert: true }
  );

  runPricePipeline().catch(console.error);
}, {
  timezone: 'Asia/Jerusalem'
});
