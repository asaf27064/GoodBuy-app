const ProductModel = require('../../models/productModel');
const {
  calcRF, detectHabits, findCo, calcCF,
  getGlobalPopularity, applyGlobalBoost,
  ensureMethodAvailability, guaranteeMethodDiversity
} = require('./engine');
const { getAISuggestions } = require('./ai');

const C = {
  MIN_HABITS: 2,
  CO_OCCURRENCE_ALPHA: 0.5,
  SIMILAR_USERS_LIMIT: 10,
  GLOBAL_BOOST_RATIO: 0.2,
  AI_TIMEOUT: 10000,
  MIN_AI_SCORE: 0.5,
  HALF_LIFE_DAYS: 30,
  DECAY_EPSILON: 0.1
};

function validateInputs(userId, currentProducts, purchaseHistory, topN) {
  if (!userId) throw new Error('userId is required');
  if (!Array.isArray(currentProducts)) throw new Error('currentProducts must be an array');
  if (!Array.isArray(purchaseHistory)) throw new Error('purchaseHistory must be an array');
  if (!Number.isInteger(topN) || topN < 1) throw new Error('topN must be a positive integer');
}

async function loadCatalog() {
  const all = await ProductModel.find().lean();
  const nameToCode = new Map();
  const canonicalToCodes = new Map();
  const codeToName = {};
  all.forEach(p => {
    const id = String(p._id);
    const name = (p.name || '').trim();
    if (!name || !id) return;
    const n = name.toLowerCase().replace(/\s+/g, ' ').replace(/[״"]/g, '');
    const c = n
      .replace(/\d+([.,]\d+)?/g, '')
      .replace(/[()\-+*/.,:;'"!?]/g, ' ')
      .replace(/\s+/g, ' ').trim();
    nameToCode.set(n, id);
    if (c) {
      if (!canonicalToCodes.has(c)) canonicalToCodes.set(c, []);
      canonicalToCodes.get(c).push(id);
    }
    codeToName[id] = name;
  });
  return { nameToCode, canonicalToCodes, codeToName };
}

module.exports = {
  recommend: async (userId, currentProducts, purchaseHistory, topN = 5, showAllAI = false) => {
    try {
      validateInputs(userId, currentProducts, purchaseHistory, topN);

      const nowMs = Date.now();
      const todayWd = new Date().getDay();
      const currentCodes = new Set(currentProducts.map(p => p.product?.itemCode).filter(Boolean));
      const currentNames = currentProducts.map(p => p.product?.name?.trim()).filter(Boolean);

      const { nameToCode, canonicalToCodes, codeToName } = await loadCatalog();

      const { scores: userScores, lastTimes } = calcRF(purchaseHistory, nowMs, C);

      const topHistory = Object.entries(userScores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([code]) => codeToName[code])
        .filter(Boolean);

      const earlyCtx = {
        currentCodes, userScores, lastTimes,
        globalCounts: {},
        nameToCode, canonicalToCodes, codeToName,
        debug: {}
      };
      const aiPromise = getAISuggestions(topHistory, currentNames, topN, earlyCtx, C);

      const habit = detectHabits(purchaseHistory, todayWd, currentCodes, C);
      const co = findCo(purchaseHistory, currentCodes, userScores, C);
      const cf = await calcCF(purchaseHistory, userId, currentCodes, C);

      const { counts: globalCounts, maxCount } = await getGlobalPopularity(C);

      const personal = Object.entries(userScores)
        .filter(([code]) => !currentCodes.has(code))
        .map(([code, score]) => ({ code, score, method: 'personal' }));

      const boostedCo = applyGlobalBoost(co, globalCounts, maxCount, C);
      const boostedPersonal = applyGlobalBoost(personal, globalCounts, maxCount, C);

      const pools = {
        habit: habit.sort((a, b) => b.score - a.score),
        co: boostedCo.sort((a, b) => b.score - a.score),
        cf: cf.sort((a, b) => b.score - a.score),
        personal: boostedPersonal.sort((a, b) => b.score - a.score)
      };

      const debug = { ai: null, methods: null, final: null, supplementaryAI: null, supplementaryOther: null };

      let ai = [];
      try { ai = await aiPromise; } catch {}

      if (ai.length) pools.ai = ai;

      ensureMethodAvailability(pools, globalCounts, currentCodes, C);
      const final = guaranteeMethodDiversity(pools, topN, C);

      const format = (item) => {
        const dates = purchaseHistory
          .filter(b => b.products?.some(p => p.product?.itemCode === item.code))
          .map(b => new Date(b.timeStamp).getTime())
          .filter(Boolean);
        return {
          itemCode: item.code,
          score: Math.round(item.score * 1000) / 1000,
          method: item.method,
          lastPurchased: dates.length ? Math.max(...dates) : null,
          suggestionName: item.suggestionName,
          suggestionReason: item.suggestionReason,
          isSupplementary: item.isSupplementary || false
        };
      };

      debug.methods = {
        habit: (pools.habit || []).map(x => ({ code: x.code, score: x.score, method: 'habit' })),
        co: (pools.co || []).map(x => ({ code: x.code, score: x.score, method: 'co' })),
        cf: (pools.cf || []).map(x => ({ code: x.code, score: x.score, method: 'cf' })),
        personal: (pools.personal || []).map(x => ({ code: x.code, score: x.score, method: 'personal' })),
        ai: (pools.ai || []).map(x => ({ code: x.code, score: x.score, method: 'ai', suggestionName: x.suggestionName }))
      };
      if (earlyCtx.debug && earlyCtx.debug.ai) debug.ai = earlyCtx.debug.ai;

      if (showAllAI) {
        const used = new Set(final.map(i => i.code));
        const usedSupp = new Set(used);

        const supplementaryAI = [];
        for (const aiItem of (pools.ai || [])) {
          if (usedSupp.has(aiItem.code)) continue;
          supplementaryAI.push({ ...aiItem, isSupplementary: true });
          usedSupp.add(aiItem.code);
        }

        const supplementaryOther = [];
        const perMethodCap = 3;
        const caps = { habit: 0, co: 0, cf: 0, personal: 0 };
        for (const m of ['habit', 'co', 'cf', 'personal']) {
          const pool = pools[m] || [];
          for (const it of pool) {
            if (caps[m] >= perMethodCap) break;
            if (usedSupp.has(it.code)) continue;
            supplementaryOther.push({ ...it, isSupplementary: true });
            usedSupp.add(it.code);
            caps[m] += 1;
          }
        }

        debug.final = final.map(x => ({ code: x.code, score: x.score, method: x.method }));
        debug.supplementaryAI = supplementaryAI.map(x => ({ code: x.code, score: x.score, method: x.method }));
        debug.supplementaryOther = supplementaryOther.map(x => ({ code: x.code, score: x.score, method: x.method }));

        return {
          main: final.map(format),
          supplementaryAI: supplementaryAI.map(format),
          supplementaryOther: supplementaryOther.map(format),
          totalAIGenerated: (pools.ai || []).length,
          aiUsedInMain: final.filter(x => x.method === 'ai').length,
          totalSupplementaryAI: supplementaryAI.length,
          totalSupplementaryOther: supplementaryOther.length,
          debug
        };
      } else {
        return final.map(format);
      }
    } catch {
      return showAllAI ? {
        main: [], supplementaryAI: [], supplementaryOther: [],
        totalAIGenerated: 0, aiUsedInMain: 0
      } : [];
    }
  }
};
