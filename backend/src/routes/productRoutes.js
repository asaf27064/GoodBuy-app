const express = require('express');
const productController = require('../controllers/productController');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/search/:name', productController.searchItems);
router.get('/list_price', productController.getListPriceInStores);
router.get('/:id', productController.getById);

module.exports = router;
