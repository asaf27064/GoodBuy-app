const Product   = require('../models/productModel');
const ItemImage = require('../models/ItemImage');
const ProductWithPrice = require('../models/PriceItem');
const escapeRegex = s => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

exports.searchItems = async (req, res) => {
  const term = (req.params.name || '').trim()
  if (!term) return res.json({ results: [] })

  try {
    const regex   = new RegExp('^' + escapeRegex(term), 'i')

    const docs = await Product
      .find({ name: { $regex: regex } })
      .limit(30)
      .lean()

    const codes  = docs.map(d => d._id)
    const imgs   = await ItemImage.find(
      { itemCode: { $in: codes }, status: 'found' },
      'itemCode'
    ).lean()
    const hasImg = new Set(imgs.map(i => i.itemCode))

    const base = process.env.PUBLIC_DEV_URL || ''
    const results = docs
      .map(d => ({
        itemCode : d._id,
        itemName : d.name,
        imageUrl : d.image || (base ? `${base}/images/${d._id}.png` : null),
        hasImage : hasImg.has(d._id)
      }))
      .sort((a, b) => (a.hasImage === b.hasImage ? 0 : a.hasImage ? -1 : 1))

    res.json({ results })
  } catch (err) {
    console.error('searchItems error:', err)
    res.status(500).json({ message: 'Server error' })
  }
}

exports.getById = async (req, res) => {
  try {
    const { id } = req.params
    const item = await ProductWithPrice.findById(id, 'itemCode itemName itemPrice')
      .lean({ virtuals: true })
    if (!item) return res.status(404).json({ error: 'Item not found' })

    return res.json({
      itemCode:  item.itemCode,
      itemName:  item.itemName,
      itemPrice: item.itemPrice,
      imageUrl:  item.imageUrl
    })
  } catch (err) {
    console.error('getById error:', err)
    return res.status(500).json({ error: err.message })
  }
}

exports.getListPriceInStores = async (req, res) => {
  try {
    let stores, products
    try {
      stores   = JSON.parse(req.query.stores || '[]')
      products = JSON.parse(req.query.products || '{}')
    } catch {
      return res.status(400).json({ error: 'Invalid JSON in query params' })
    }
    if (!Array.isArray(stores) || typeof products !== 'object' || products === null || Array.isArray(products)) {
      return res.status(400).json({ error: 'Bad request shape' })
    }

    // Extract itemcodes into a list (strings only — prevents passing objects that
    // would otherwise turn into NoSQL operator injections inside $in).
    const itemCodes = Object.keys(products).filter(k => typeof k === 'string')

    const pricesInStores = [];

    for(const store of stores) {
      if (!store || typeof store !== 'object' || typeof store.storeId !== 'string') continue;

      const productsMatched = await ProductWithPrice.find({
        itemCode: { $in: itemCodes },
        storeRef: store.storeId
      });
      
      const priceMap = {};
      for (const product of productsMatched) {
        // Map the an item's code to its price.
        priceMap[product.itemCode] = product.itemPrice;
      }

      const orderedProductPrices = itemCodes.map(code => {
        const p = products[code] || {}
        return {productCode: code, name: typeof p.name === 'string' ? p.name : '', amount: Number(p.amount) || 0, unitPrice: (Object.prototype.hasOwnProperty.call(priceMap, code) ? priceMap[code] : null)}
      });
      

      pricesInStores.push({ storeId: store.storeId, distance: store.distance, productPrices: orderedProductPrices });
  }

    if (!pricesInStores) {
        return res.status(404).json({ error: 'Product not found' });
    }

    res.json(pricesInStores);
} catch (error) {
    res.status(500).json({ error: error.message });
}
  };