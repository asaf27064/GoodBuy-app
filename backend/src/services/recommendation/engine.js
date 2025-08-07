const PurchaseModel = require('../../models/purchaseModel');

// RF + lastTimes
function calcRF(history, nowMs, C) {
  const scores = {};
  const lastTimes = {};
  const MS_PER_DAY = 86400000;
  const lambda = Math.log(2) / C.HALF_LIFE_DAYS;
  history.forEach(b => {
    const t = new Date(b.timeStamp).getTime();
    if (isNaN(t)) return;
    const days = Math.max(0, (nowMs - t) / MS_PER_DAY);
    const w = Math.max(C.DECAY_EPSILON, Math.exp(-lambda * days));
    b.products?.forEach(({ product, numUnits }) => {
      const code = product?.itemCode;
      if (!code) return;
      const units = Math.max(1, Number(numUnits) || 1);
      scores[code] = (scores[code] || 0) + w * units;
      if (!lastTimes[code] || t > lastTimes[code]) lastTimes[code] = t;
    });
  });
  return { scores, lastTimes };
}

// Habits
function detectHabits(history, todayWd, currentCodes, C) {
  const wdCounts = {};
  history.forEach(b => {
    const d = new Date(b.timeStamp);
    if (isNaN(d)) return;
    const wd = d.getDay();
    b.products?.forEach(({ product }) => {
      const code = product?.itemCode;
      if (!code) return;
      wdCounts[code] = wdCounts[code] || {};
      wdCounts[code][wd] = (wdCounts[code][wd] || 0) + 1;
    });
  });

  let cand = Object.entries(wdCounts)
    .filter(([code, counts]) => !currentCodes.has(code) && (counts[todayWd] || 0) >= C.MIN_HABITS)
    .map(([code, counts]) => ({ code, score: counts[todayWd], method: 'habit' }));

  if (cand.length === 0) {
    cand = Object.entries(wdCounts)
      .filter(([code, counts]) => {
        if (currentCodes.has(code)) return false;
        const mx = Math.max(...Object.values(counts));
        return mx >= C.MIN_HABITS;
      })
      .map(([code, counts]) => ({ code, score: Math.max(...Object.values(counts)), method: 'habit' }))
      .slice(0, 5);
  }
  return cand;
}

// Co-occurrence with current list
function findCo(history, currentCodes, userScores, C) {
  const cnt = {};
  history.forEach(b => {
    const codes = b.products?.map(p => p.product?.itemCode).filter(Boolean) || [];
    if (!codes.some(c => currentCodes.has(c))) return;
    codes.forEach(c => { if (!currentCodes.has(c)) cnt[c] = (cnt[c] || 0) + 1; });
  });
  return Object.entries(cnt)
    .filter(([code]) => !currentCodes.has(code))
    .map(([code, co]) => ({
      code,
      score: co * (1 + C.CO_OCCURRENCE_ALPHA * (userScores[code] || 0)),
      method: 'co'
    }));
}

// CF
async function calcCF(history, userId, currentCodes, C) {
  const userSet = new Set(
    history.flatMap(b => b.products?.map(p => p.product?.itemCode).filter(Boolean) || [])
  );
  if (userSet.size === 0) return [];

  const all = await PurchaseModel.find({ purchasedBy: { $ne: userId } }).lean();
  const map = {};
  all.forEach(b => {
    const uid = b.purchasedBy?.toString(); if (!uid) return;
    map[uid] = map[uid] || new Set();
    b.products?.forEach(p => { const c = p.product?.itemCode; if (c) map[uid].add(c); });
  });

  const sims = Object.entries(map)
    .map(([uid, set]) => {
      const inter = [...set].filter(x => userSet.has(x)).length;
      const uni = new Set([...set, ...userSet]).size;
      return { uid, sim: uni ? inter / uni : 0 };
    })
    .filter(x => x.sim > 0)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, C.SIMILAR_USERS_LIMIT);

  const scores = {};
  sims.forEach(({ uid, sim }) => {
    map[uid].forEach(code => { if (!currentCodes.has(code)) scores[code] = (scores[code] || 0) + sim; });
  });

  return Object.entries(scores).map(([code, score]) => ({ code, score, method: 'cf' }));
}

// Popularity counts
async function getGlobalPopularity(/* C */) {
  const agg = await PurchaseModel.aggregate([
    { $unwind: '$products' },
    { $group: { _id: '$products.product.itemCode', count: { $sum: 1 } } }
  ]);
  const maxCount = Math.max(...agg.map(g => g.count), 1);
  return { counts: Object.fromEntries(agg.map(g => [g._id, g.count])), maxCount };
}

// Popularity boost
function applyGlobalBoost(cands, counts, maxCount, C) {
  const r = C.GLOBAL_BOOST_RATIO;
  return cands.map(item => ({
    ...item,
    score: item.score + ((counts[item.code] || 0) / maxCount) * r * item.score
  }));
}

// Ensure coverage for non-AI methods
function ensureMethodAvailability(pools, counts, currentCodes, C) {
  const nonAI = ['habit', 'co', 'cf', 'personal'];
  const avail = Object.entries(counts)
    .filter(([code]) => !currentCodes.has(code))
    .sort(([, a], [, b]) => b - a);

  nonAI.forEach(method => {
    if (!pools[method] || pools[method].length === 0) {
      let slice, name;
      switch (method) {
        case 'personal': slice = avail.slice(0, Math.min(5, avail.length)); name = 'personal'; break;
        case 'co':       slice = avail.slice(0, Math.min(3, avail.length)); name = 'co'; break;
        case 'cf':       slice = avail.slice(Math.min(5, avail.length), Math.min(8, avail.length)); name = 'cf'; break;
        case 'habit':    slice = avail.slice(Math.min(8, avail.length), Math.min(10, avail.length)); name = 'habit'; break;
      }
      pools[method] = slice.map(([code], i) => ({ code, score: slice.length - i, method: name }));
    }
  });
}

// Guarantee method diversity in final results
function guaranteeMethodDiversity(pools, topN /*, C */) {
  const nonAI = ['habit', 'co', 'cf', 'personal'];
  const final = [], used = new Set();

  const ai = pools.ai || [];
  if (ai.length && !used.has(ai[0].code)) { used.add(ai[0].code); final.push(ai[0]); }

  nonAI.forEach(m => {
    if (final.length >= topN) return;
    const pool = pools[m] || [];
    for (const c of pool) {
      if (!used.has(c.code)) { used.add(c.code); final.push(c); break; }
    }
  });

  const rest = [];
  Object.values(pools).forEach(pool => pool?.forEach(c => { if (!used.has(c.code)) rest.push(c); }));
  rest.sort((a, b) => b.score - a.score).forEach(c => {
    if (final.length < topN && !used.has(c.code)) { used.add(c.code); final.push(c); }
  });

  if (final.length > topN) final.length = topN;
  return final;
}

module.exports = {
  calcRF, detectHabits, findCo, calcCF,
  getGlobalPopularity, applyGlobalBoost,
  ensureMethodAvailability, guaranteeMethodDiversity
};
