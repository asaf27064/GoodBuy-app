require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const { MongoClient } = require('mongodb')
const path = require('path')

const MONGO_URI   = process.env.MONGO_URI
if (!MONGO_URI) throw new Error('Missing MONGO_URI')

const DB_NAME     = process.env.MONGO_DB || undefined
const SOURCE_COLL = 'priceitems'
const TARGET_COLL = 'products'
const TMP_COLL    = TARGET_COLL + '_tmp'

const pipeline = [
  { $match: { itemStatus: { $ne: 9 }, $expr: {
    $gte: [ { $strLenCP: "$itemCode" }, 7 ]
  }} },
  {
    $group: {
      _id  : '$itemCode',
      name : { $first: '$itemName' },
      image: {
        $first: {
          $concat: [
            process.env.PUBLIC_DEV_URL || '',
            '/images/',
            '$itemCode',
            '.png'
          ]
        }
      }
    }
  },
  { $out: TMP_COLL }
]

;(async () => {
  const client = await new MongoClient(MONGO_URI).connect()
  const db     = DB_NAME ? client.db(DB_NAME) : client.db()

  console.time('build-products')

  await db.collection(SOURCE_COLL)
          .aggregate(pipeline, { allowDiskUse: true })
          .toArray()

  await db.collection(TMP_COLL).createIndex({ name: 1 })

  await db.collection(TMP_COLL).rename(TARGET_COLL, { dropTarget: true })

  console.timeEnd('build-products')
  await client.close()
  process.exit(0)
})().catch(err => {
  console.error('build-products failed:', err)
  process.exit(1)
})
