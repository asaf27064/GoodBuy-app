const Store = require('../models/storeModel');
const { findNearestStores }  = require('../findNearestStores');

// CRUD endpoints below were unused by the mobile app and referenced
// undefined globals (`Item`, `History`) — every call produced a ReferenceError
// 500 that leaked internal stack info. Return 501 until they are reimplemented.
const notImplemented = (req, res) => res.status(501).json({ error: 'Not implemented' });

exports.getAllItems  = notImplemented;
exports.addItem      = notImplemented;
exports.deleteItem   = notImplemented;
exports.updateItem   = notImplemented;
exports.getItemByID  = notImplemented;

exports.searchStores = async (req, res) => {
  try {
    const latitude  = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
    const nearestStores = findNearestStores({ latitude, longitude });
    if (!nearestStores || !nearestStores.length) {
      return res.status(404).json({ error: 'Could not locate any stores near you.' });
    }
    res.json(nearestStores);
  } catch (error) {
    console.error('searchStores error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
