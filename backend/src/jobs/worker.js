// Standalone scraping/price-refresh worker.
//
// WHY: Puppeteer + FTP scrapers + XML parsers are heavy. Running them inside
// the API process (the old design) means a memory spike or CPU stall in the
// scraper freezes login, list edits, and recommendations for every user. This
// process is identical to the API process in terms of Node + Mongo
// connectivity, but runs the pipeline in its own isolated event loop.
//
// HOW IT GETS WORK:
//  1. A cron tick fires daily at 05:30 Asia/Jerusalem.
//  2. An authenticated user hits POST /api/system/price-refresh on the API,
//     which writes `requestedAt: new Date()` to the SystemMeta document.
//     This worker polls SystemMeta every 5s; if `requestedAt > lastRunStart`,
//     it triggers a run.
//
// Both paths converge on `runPipelineOnce()`, which is single-flight — calls
// while the pipeline is in flight are no-ops, not queued, so a runaway click
// can't stack runs.
//
// USAGE: `node backend/src/jobs/worker.js` (or via the `worker` npm script).
// Mongo connection details come from backend/src/.env, same as the API.

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const { spawn } = require('child_process')
const mongoose = require('mongoose')
const cron = require('node-cron')
const SystemMeta = require('../models/SystemMeta')

const POLL_INTERVAL_MS = 5000
const CRON_EXPR        = '30 5 * * *'      // 05:30 daily
const CRON_TZ          = 'Asia/Jerusalem'

let running = false

async function runPipelineOnce(reason) {
  if (running) {
    console.log(`[worker] Skip ${reason} — pipeline already running`)
    return
  }
  running = true
  const startedAt = new Date()
  console.log(`[worker] ▶ Starting pipeline (${reason}) at ${startedAt.toISOString()}`)

  await SystemMeta.findByIdAndUpdate(
    'price-refresh',
    { $set: { lastRunStart: startedAt, lastRunOk: false, running: true } },
    { upsert: true }
  )

  const exitCode = await new Promise((resolve) => {
    const proc = spawn('node', ['priceFetch/pipeline.js', 'update'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    })
    proc.on('exit', (code) => resolve(code ?? 1))
    proc.on('error', (err) => {
      console.error('[worker] Pipeline spawn error:', err)
      resolve(1)
    })
  })

  await SystemMeta.findByIdAndUpdate('price-refresh', {
    $set: { lastRunEnd: new Date(), lastRunOk: exitCode === 0, running: false },
  })

  console.log(`[worker] ◼ Pipeline exited with code ${exitCode}`)
  running = false
}

async function pollOnce() {
  if (running) return
  const meta = await SystemMeta.findById('price-refresh').lean()
  if (!meta?.requestedAt) return
  const requested = new Date(meta.requestedAt).getTime()
  const lastStart = meta.lastRunStart ? new Date(meta.lastRunStart).getTime() : 0
  if (requested > lastStart) {
    await runPipelineOnce('manual').catch(console.error)
  }
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('[worker] MONGO_URI is not set — check backend/src/.env')
    process.exit(1)
  }
  await mongoose.connect(process.env.MONGO_URI)
  console.log('[worker] Connected to MongoDB')

  cron.schedule(CRON_EXPR, () => {
    console.log('[worker] ⏰ Cron trigger fired')
    runPipelineOnce('cron').catch(console.error)
  }, { timezone: CRON_TZ })
  console.log(`[worker] Cron scheduled: ${CRON_EXPR} (${CRON_TZ})`)

  setInterval(() => pollOnce().catch(console.error), POLL_INTERVAL_MS)
  console.log(`[worker] Polling for manual triggers every ${POLL_INTERVAL_MS}ms`)
  console.log('[worker] Ready.')
}

main().catch((err) => {
  console.error('[worker] Fatal:', err)
  process.exit(1)
})
