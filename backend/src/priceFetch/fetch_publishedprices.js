/*const puppeteer = require('puppeteer')
const axios     = require('axios')
const fs        = require('fs')
const path      = require('path')

const DOWNLOAD_DIR = path.join(__dirname, 'Downloads')
const mode = process.argv[2] === 'update' ? 'update' : 'init'
console.log(`📦 Running in ${mode.toUpperCase()} mode`)

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })
const allRetailers = require('./retailers.json')
const webRetailers = allRetailers.filter(r => r.url && r.url.includes('url.publishedprices.co.il'))

;(async () => {
  const browser = await puppeteer.launch({ headless: true })

  for (const entry of webRetailers) {
    console.log(`\n🔐 ${entry.name}`)
    await handleWeb(entry, browser)
  }

  await browser.close()
  console.log('\n✅ All done')
})()

async function handleWeb(entry, browser) {
  const page = await browser.newPage()
  try {
    await page.goto(entry.url, { waitUntil: 'networkidle2' })
    await page.type('#username', entry.login.username)
    if (entry.login.password) await page.type('#password', entry.login.password)
    await Promise.all([
      page.click('button[type="submit"], input[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ])

    const isDorAlon = entry.name.includes('דור אלון')
    const selectorTimeout = isDorAlon ? 90000 : 30000
    await page.waitForSelector('#fileList tbody tr', { timeout: selectorTimeout })

    let raw
    if (isDorAlon) {
      const html = await page.content()
      raw = []
      const gzRe = /href="([^\"]+\.gz)"/g
      let m
      while ((m = gzRe.exec(html))) {
        raw.push(new URL(m[1], page.url()).href)
      }
    } else {
      raw = await page.$$eval(
        '#fileList tbody tr a.f',
        els => els.map(a => a.href || a.getAttribute('href'))
      )
    }

    const links = raw
      .map(h => new URL(h, page.url()).href)
      .filter(h => matchMode(path.basename(h).toLowerCase()))
    if (!links.length) {
      console.warn(`   ⚠️ No matching files for ${entry.name}`)
      return
    }

    const files = links.map(parseFilename).filter(Boolean)
    const newest = pickNewest(files)
    
    const cookies = await page.cookies()
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    for (const f of Object.values(newest)) {
      const out = path.join(DOWNLOAD_DIR, f.name)
      if (fs.existsSync(out)) continue
      console.log(`   ⬇️  ${f.name}`)
      const res = await axios.get(f.link, {
        responseType: 'stream', timeout: 90000, decompress: false,
        headers: { Cookie: cookieHeader, 'Accept-Encoding': 'identity' }
      })
      const ws = fs.createWriteStream(out)
      res.data.pipe(ws)
      await new Promise((r, e) => ws.on('finish', r).on('error', e))
      console.log(`     ✔️ Saved to ${out}`)
    }
  } catch (err) {
    console.error(`   ❌ ${entry.name}: ${err.message}`)
  } finally {
    await page.close()
  }
}

// helpers
function matchMode(name) {
  if (mode === 'init') return /^pricefull.*\.gz$/.test(name)
  return (
    (/^prices.*\.gz$/.test(name) ||
      (/^price.*\.gz$/.test(name) && !/^pricefull/.test(name)))
  )
}

function parseFilename(link) {
  const name = path.basename(link.split('?')[0])
  let m = name.match(/(?:PriceFull|Prices|Price)\d+-\d+-([0-9]+)-(\d{8})-(\d{6})\.gz$/i)
  let storeId, ts
  if (m) {
    storeId = m[1]
    ts = m[2] + m[3]
  } else {
    m = name.match(/(?:PriceFull|Prices|Price)\d+-([0-9]+)-(\d{12})\.gz$/i)
    if (m) {
      storeId = m[1]
      const dt = m[2]
      ts = dt.slice(0, 8) + dt.slice(8, 12) + '00'
    } else {
      return null
    }
  }
  return { link, name, storeId, ts }
}

function pickNewest(arr) {
  return arr.reduce((map, f) => {
    if (!map[f.storeId] || f.ts > map[f.storeId].ts) map[f.storeId] = f
    return map
  }, {})
}*/

const puppeteer = require('puppeteer')
const axios     = require('axios')
const fs        = require('fs')
const path      = require('path')
const https     = require('https')


const DOWNLOAD_DIR = path.join(__dirname, 'Downloads')
const mode = process.argv[2] === 'update' ? 'update' : 'init'
console.log(`📦 Running in ${mode.toUpperCase()} mode`)

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })
const allRetailers = require('./retailers.json')
const webRetailers = allRetailers.filter(r => r.url && r.url.includes('url.publishedprices.co.il'))

;(async () => {
  const browser = await puppeteer.launch({ headless: true })

  for (const entry of webRetailers) {
    console.log(`\n🔐 ${entry.name}`)
    await handleWeb(entry, browser)
  }

  await browser.close()
  console.log('\n✅ All done')
})()

async function handleWeb(entry, browser) {
  const page = await browser.newPage()
  try {
    await page.goto(entry.url, { waitUntil: 'networkidle2' })
    await page.type('#username', entry.login.username)
    if (entry.login.password) await page.type('#password', entry.login.password)
    await Promise.all([
      page.click('button[type="submit"], input[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ])

    const isDorAlon = entry.name.includes('דור אלון')
    const selectorTimeout = isDorAlon ? 90000 : 30000
    await page.waitForSelector('#fileList tbody tr', { timeout: selectorTimeout })

    let raw
    if (isDorAlon) {
      const html = await page.content()
      raw = []
      const gzRe = /href="([^\"]+\.gz)"/g
      let m
      while ((m = gzRe.exec(html))) {
        raw.push(new URL(m[1], page.url()).href)
      }
    } else {
      raw = await page.$$eval(
        '#fileList tbody tr a.f',
        els => els.map(a => a.href || a.getAttribute('href'))
      )
    }

    const links = raw
      .map(h => new URL(h, page.url()).href)
      .filter(h => matchMode(path.basename(h).toLowerCase()))
    if (!links.length) {
      console.warn(`   ⚠️ No matching files for ${entry.name}`)
      return
    }

    const files = links.map(parseFilename).filter(Boolean)
    const newest = pickNewest(files)

    const cookies = await page.cookies()
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    for (const f of Object.values(newest)) {
      const out = path.join(DOWNLOAD_DIR, f.name)
      if (fs.existsSync(out)) continue
      console.log(`   ⬇️  ${f.name}`)
      const res = await axios.get(f.link, {
        responseType: 'stream',
        timeout: 90000,
        decompress: false,
        headers: { Cookie: cookieHeader, 'Accept-Encoding': 'identity' },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      })
      const ws = fs.createWriteStream(out)
      res.data.pipe(ws)
      await new Promise((r, e) => ws.on('finish', r).on('error', e))
      console.log(`     ✔️ Saved to ${out}`)
    }
  } catch (err) {
    console.error(`   ❌ ${entry.name}: ${err.message}`)
  } finally {
    await page.close()
  }
}

// helpers
function matchMode(name) {
  if (mode === 'init') return /^pricefull.*\.gz$/.test(name)
  return (
    (/^prices.*\.gz$/.test(name) ||
      (/^price.*\.gz$/.test(name) && !/^pricefull/.test(name)))
  )
}

function parseFilename(link) {
  const name = path.basename(link.split('?')[0])
  let m = name.match(/(?:PriceFull|Prices|Price)\d+-\d+-([0-9]+)-(\d{8})-(\d{6})\.gz$/i)
  let storeId, ts
  if (m) {
    storeId = m[1]
    ts = m[2] + m[3]
  } else {
    m = name.match(/(?:PriceFull|Prices|Price)\d+-([0-9]+)-(\d{12})\.gz$/i)
    if (m) {
      storeId = m[1]
      const dt = m[2]
      ts = dt.slice(0, 8) + dt.slice(8, 12) + '00'
    } else {
      return null
    }
  }
  return { link, name, storeId, ts }
}

function pickNewest(arr) {
  return arr.reduce((map, f) => {
    if (!map[f.storeId] || f.ts > map[f.storeId].ts) map[f.storeId] = f
    return map
  }, {})
}
