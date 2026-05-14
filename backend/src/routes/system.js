const express        = require('express');
const router         = express.Router();
const auth           = require('../middleware/auth');
const SystemMeta     = require('../models/SystemMeta');
const runPricePpln   = require('../jobs/run-price-pipeline');

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

// Triggering the pipeline is expensive — require auth (was wide-open before)
router.post('/price-refresh', auth, async (req, res) => {
  const meta = await SystemMeta.findById('price-refresh').lean();

  if (isRunning(meta))
    return res.status(409).json({ message: 'Refresh already running' });

  runPricePpln().catch(console.error);
  res.json({ message: 'Triggered' });
});

module.exports = router;
