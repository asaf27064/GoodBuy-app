const express = require('express');
const purchaseController = require('../controllers/purchaseController');
const router = express.Router();
const auth = require('../middleware/auth')

// Auth required for ALL purchase endpoints (history is PII)
router.use(auth)

// Static routes must come BEFORE param routes to avoid shadowing
router.get('/history', purchaseController.getHistory);

router.post('/', purchaseController.createPurchase);

router.get('/:user_id', purchaseController.getUserPurchases);

module.exports = router;
