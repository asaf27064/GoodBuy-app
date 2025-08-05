const mongoose = require('mongoose')
const { Schema } = mongoose

const productRefSchema = new Schema({
  itemCode: { type: String, required: true },
  name: { type: String, required: true },
  image: { type: String, default: '' }
}, { _id: false })

const productQtySchema = new Schema({
  product: productRefSchema,
  numUnits: { type: Number, required: true, min: 1, default: 1 }
}, { _id: false })

const purchaseSchema = new Schema({
  listId: { type: Schema.Types.ObjectId, ref: 'ShoppingList', required: true },
  timeStamp: { type: Date, default: Date.now },
  purchasedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  membersSnapshot: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
  products: [productQtySchema]
})

purchaseSchema.index({ purchasedBy: 1, timeStamp: -1 })
purchaseSchema.index({ 'products.product.itemCode': 1 })

module.exports = mongoose.model('Purchase', purchaseSchema)
