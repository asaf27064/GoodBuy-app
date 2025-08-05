const express = require('express')
const auth = require('../middleware/auth')
const ctrl = require('../controllers/shoppingListController')
const router = express.Router()

router.use(auth)
router.get('/',    ctrl.getAllUserShoppingLists)
router.post('/',   ctrl.createList)
router.get('/:id', ctrl.getShoppingList)
router.put('/:id', ctrl.updateListProducts)
router.post('/:id/leave', ctrl.leaveList)


module.exports = router
