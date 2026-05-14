const mongoose = require('mongoose')
module.exports = mongoose.model(
  'SystemMeta',
  new mongoose.Schema({
    _id          : { type: String, default: 'price-refresh' },
    lastRunStart : Date,
    lastRunEnd   : Date,
    lastRunOk    : Boolean,
    nextPlanned  : Date,
    // Queue marker: API writes `requestedAt` when a user clicks "refresh".
    // The worker process polls for `requestedAt > lastRunStart` and runs the
    // pipeline. This decouples the API process from the heavy scraping job.
    requestedAt  : Date,
  }),
  'system_meta'
)
