const axios   = require('axios')
const cheerio = require('cheerio')
const fs      = require('fs')
const path    = require('path')

const mode = process.argv[2] === 'update' ? 'update' : 'init'
console.log(`📦 Running in mode: ${mode === 'update' ? 'UPDATE (Price/Prices)' : 'INIT (PriceFull)'}`)

const DOWNLOAD_DIR = path.join(__dirname, 'Downloads')
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })

async function extractRelevantFiles (site) {
  try {
    const { data: html } = await axios.get(site, { timeout: 5000 })
    const $ = cheerio.load(html)
    let filesJson = null
    $('script').each((_, el) => {
      const m = ($(el).html() || '').match(/const\s+files\s*=\s*JSON\.parse\(`([\s\S]*?)`\)/)
      if (m) filesJson = m[1]
    })
    if (!filesJson) return []

    const files = JSON.parse(filesJson)
    return files
      .filter(n => mode === 'init' ? n.startsWith('PriceFull') : /^Price(s)?/.test(n))
      .map(n => {
        const d   = n.match(/(\d{8})\d{4}\.gz$/)
        const ts  = n.match(/-(\d{12})\.gz$/)
        if (!d || !ts) return null
        const url   = `${site.replace(/\/$/, '')}/${d[1]}/${n}`
        const store = n.split('-')[1]
        return { url, store, timestamp: ts[1], name: n }
      })
      .filter(Boolean)
  } catch (e) {
    console.warn(`⚠️  Unable to parse ${site}:`, e.message)
    return []
  }
}

async function downloadLatest (site, items) {
  const newestPerStore = items.reduce((m, it) => {
    if (!m[it.store] || m[it.store].timestamp < it.timestamp) m[it.store] = it
    return m
  }, {})

  for (const { url, name } of Object.values(newestPerStore)) {
    const dest = path.join(DOWNLOAD_DIR, name)
    if (fs.existsSync(dest)) {
      console.log(`⚠️  Skipping existing ${name}`)
      continue
    }
    console.log(`⬇️  Downloading ${name} …`)
    try {
      const resp = await axios.get(url, { responseType: 'stream', timeout: 10000 })
      await new Promise((ok, err) => {
        resp.data.pipe(fs.createWriteStream(dest)).on('finish', ok).on('error', err)
      })
      console.log(`✅  Saved to ${dest}`)
    } catch (e) {
      console.warn(`⚠️  Could not fetch ${name}:`, e.response?.status || e.message)
    }
  }
}

;(async () => {
  const sites = [
    //'https://prices.ybitan.co.il/',
    'https://prices.carrefour.co.il/'
  ]

  for (const site of sites) {
    console.log(`\n🔍 Processing ${site}`)
    const items = await extractRelevantFiles(site)
    if (!items.length) {
      console.warn(`⚠️  No matching files on ${site}`)
      continue
    }
    await downloadLatest(site, items)
  }

  console.log('\n🎉 Mega/Bitan fetch finished – continuing pipeline')
  process.exit(0)   // always success
})()
