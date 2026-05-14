const express        = require('express');
const router         = express.Router();
const auth           = require('../middleware/auth');
const SystemMeta     = require('../models/SystemMeta');

function isRunning(meta) {
  return (
    meta &&
    meta.lastRunStart &&
    (!meta.lastRunEnd || meta.lastRunEnd < meta.lastRunStart)
  );
}

// Read-only status: requires auth (PriceSyncContext polls this from mobile)
router.get('/price-status', auth, async (req, res) => {
  const meta = await SystemMeta.findById('price-refresh').lean();
  if (!meta) return res.status(404).json({ message: 'Not found' });

  res.json({
    lastRunEnd : meta.lastRunEnd  ?? null,
    lastRunOk  : meta.lastRunOk   ?? null,
    running    : isRunning(meta)
  });
});

// Enqueue a refresh. The worker process (backend/src/jobs/worker.js) polls
// SystemMeta and picks this up; the API does NOT spawn anything itself.
router.post('/price-refresh', auth, async (req, res) => {
  const meta = await SystemMeta.findById('price-refresh').lean();

  if (isRunning(meta))
    return res.status(409).json({ message: 'Refresh already running' });

  await SystemMeta.findByIdAndUpdate(
    'price-refresh',
    { $set: { requestedAt: new Date() } },
    { upsert: true }
  );
  res.json({ message: 'Triggered' });
});

module.exports = router;
