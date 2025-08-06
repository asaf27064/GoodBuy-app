const { GoogleGenAI } = require('@google/genai');
const PurchaseModel = require('../models/purchaseModel');
const ProductModel = require('../models/productModel');

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// tuned constants
const CONSTANTS = {
  MIN_HABITS: 2,
  CO_OCCURRENCE_ALPHA: 0.5,
  SIMILAR_USERS_LIMIT: 10,
  GLOBAL_BOOST_RATIO: 0.2,
  AI_TIMEOUT: 10000,
  MIN_AI_SCORE: 0.5,
  GUARANTEED_METHODS: ['ai', 'co', 'personal', 'cf', 'habit'],
  HALF_LIFE_DAYS: 60,
  DECAY_EPSILON: 0.1
};

const MS_PER_DAY = 86400000;

// normalize (Hebrew-safe)
function normName(s) {
  return s?.trim().replace(/\s+/g, ' ').replace(/[״"]/g, '').toLowerCase();
}

// canonical bucket (strip sizes/units/numbers/punct)
function canonicalKey(s) {
  let x = normName(s);
  x = x.replace(/\d+([.,]\d+)?\s*(קג|ק\"ג|קילו|גר?ם|ג\'|ml|מ\"ל|מיליליטר|ליטר|יחידות?|גלילים?|חבילות?)/g, '');
  x = x.replace(/\d+([.,]\d+)?/g, '');
  x = x.replace(/[()\-+*/.,:;'"!?]/g, ' ');
  x = x.replace(/\s+/g, ' ').trim();
  return x;
}

// decay by days + floor
function decayWeight(ageMs) {
  const ageDays = ageMs / MS_PER_DAY;
  const lambda = Math.log(2) / CONSTANTS.HALF_LIFE_DAYS;
  const w = Math.exp(-lambda * ageDays);
  return Math.max(CONSTANTS.DECAY_EPSILON, w);
}

// quick JSON array from LLM text
function extractJsonArray(rawText) {
  if (!rawText || typeof rawText !== 'string') throw new Error('Invalid AI response');
  try {
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\[([\s\S]*?)\]/m);
    if (!match) throw new Error('No JSON array found');
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) throw new Error('Not an array');
    return parsed;
  } catch (e) {
    console.error('JSON parsing error:', e.message);
    throw new Error(`Failed to parse AI response: ${e.message}`);
  }
}

// inputs
function validateInputs(userId, currentProducts, purchaseHistory, topN) {
  if (!userId) throw new Error('userId is required');
  if (!Array.isArray(currentProducts)) throw new Error('currentProducts must be an array');
  if (!Array.isArray(purchaseHistory)) throw new Error('purchaseHistory must be an array');
  if (!Number.isInteger(topN) || topN < 1) throw new Error('topN must be a positive integer');
}

// RF scores
function calculateRecencyFrequencyScores(purchaseHistory, now) {
  const userScores = {};
  purchaseHistory.forEach(purchase => {
    const d = new Date(purchase.timeStamp);
    if (isNaN(d)) return;
    const age = Math.max(0, now - d);
    const decay = decayWeight(age);
    purchase.products?.forEach(({ product, numUnits }) => {
      const code = product?.itemCode;
      if (!code) return;
      const units = Math.max(1, Number(numUnits) || 1);
      userScores[code] = (userScores[code] || 0) + decay * units;
    });
  });
  return userScores;
}

// weekday habits
function detectHabits(purchaseHistory, todayWd, currentCodes) {
  const weekdayCounts = {};
  const { MIN_HABITS } = CONSTANTS;

  purchaseHistory.forEach(purchase => {
    const d = new Date(purchase.timeStamp);
    if (isNaN(d)) return;
    const wd = d.getDay();
    purchase.products?.forEach(({ product }) => {
      const code = product?.itemCode;
      if (!code) return;
      weekdayCounts[code] = weekdayCounts[code] || {};
      weekdayCounts[code][wd] = (weekdayCounts[code][wd] || 0) + 1;
    });
  });

  let candidates = Object.entries(weekdayCounts)
    .filter(([code, counts]) => !currentCodes.has(code) && (counts[todayWd] || 0) >= MIN_HABITS)
    .map(([code, counts]) => ({ code, score: counts[todayWd], method: 'habit' }));

  if (candidates.length === 0) {
    candidates = Object.entries(weekdayCounts)
      .filter(([code, counts]) => {
        if (currentCodes.has(code)) return false;
        const maxDayCount = Math.max(...Object.values(counts));
        return maxDayCount >= MIN_HABITS;
      })
      .map(([code, counts]) => {
        const maxDayCount = Math.max(...Object.values(counts));
        return { code, score: maxDayCount, method: 'habit' };
      })
      .slice(0, 5);
  }
  return candidates;
}

// co-occurrence
function findCoOccurrenceCandidates(purchaseHistory, currentCodes, userScores) {
  const coCounts = {};
  const { CO_OCCURRENCE_ALPHA } = CONSTANTS;

  purchaseHistory.forEach(purchase => {
    const codes = purchase.products?.map(p => p.product?.itemCode).filter(Boolean) || [];
    if (!codes.some(c => currentCodes.has(c))) return;
    codes.forEach(c => { if (!currentCodes.has(c)) coCounts[c] = (coCounts[c] || 0) + 1; });
  });

  return Object.entries(coCounts)
    .filter(([code]) => !currentCodes.has(code))
    .map(([code, co]) => ({
      code,
      score: co * (1 + CO_OCCURRENCE_ALPHA * (userScores[code] || 0)),
      method: 'co'
    }));
}

// CF (simple Jaccard)
async function calculateCollaborativeFiltering(purchaseHistory, userId, currentCodes) {
  try {
    const userSet = new Set(
      purchaseHistory.flatMap(b => b.products?.map(p => p.product?.itemCode).filter(Boolean) || [])
    );
    if (userSet.size === 0) return [];

    const allPurchases = await PurchaseModel.find({ purchasedBy: { $ne: userId } }).lean();

    const userMap = {};
    allPurchases.forEach(purchase => {
      const uid = purchase.purchasedBy?.toString();
      if (!uid) return;
      userMap[uid] = userMap[uid] || new Set();
      purchase.products?.forEach(p => {
        const code = p.product?.itemCode;
        if (code) userMap[uid].add(code);
      });
    });

    const sims = Object.entries(userMap)
      .map(([uid, set]) => {
        const a = set, b = userSet;
        const inter = [...a].filter(x => b.has(x)).length;
        const uni = new Set([...a, ...b]).size;
        return { uid, sim: uni > 0 ? inter / uni : 0 };
      })
      .filter(x => x.sim > 0)
      .sort((x, y) => y.sim - x.sim)
      .slice(0, CONSTANTS.SIMILAR_USERS_LIMIT);

    const cfScores = {};
    sims.forEach(({ uid, sim }) => {
      userMap[uid].forEach(code => {
        if (!currentCodes.has(code)) cfScores[code] = (cfScores[code] || 0) + sim;
      });
    });

    return Object.entries(cfScores).map(([code, score]) => ({ code, score, method: 'cf' }));
  } catch (e) {
    console.error('Collaborative filtering error:', e.message);
    return [];
  }
}

// global popularity
async function getGlobalPopularity() {
  try {
    const globalAgg = await PurchaseModel.aggregate([
      { $unwind: '$products' },
      { $group: { _id: '$products.product.itemCode', count: { $sum: 1 } } }
    ]);
    const maxCount = Math.max(...globalAgg.map(g => g.count), 1);
    return { counts: Object.fromEntries(globalAgg.map(g => [g._id, g.count])), maxCount };
  } catch (e) {
    console.error('Global popularity calculation error:', e.message);
    return { counts: {}, maxCount: 1 };
  }
}

// apply popularity boost
function applyGlobalBoost(candidates, globalCounts, maxCount) {
  const r = CONSTANTS.GLOBAL_BOOST_RATIO;
  return candidates.map(item => ({
    ...item,
    score: item.score + ((globalCounts[item.code] || 0) / maxCount) * r * item.score
  }));
}

// pick 1 SKU among candidates (no embeddings)
function chooseBestSKU(codes, { userScores, lastTimes, globalCounts }) {
  if (!codes?.length) return null;

  // 1) max personal score
  let best = null, bestScore = -1;
  codes.forEach(code => {
    const s = userScores[code] || 0;
    if (s > bestScore) { bestScore = s; best = code; }
  });
  if (bestScore > 0) return best;

  // 2) most recent
  best = null; let bestTime = -1;
  codes.forEach(code => {
    const t = lastTimes[code] || -1;
    if (t > bestTime) { bestTime = t; best = code; }
  });
  if (bestTime > 0) return best;

  // 3) global popularity
  best = null; bestScore = -1;
  codes.forEach(code => {
    const g = globalCounts[code] || 0;
    if (g > bestScore) { bestScore = g; best = code; }
  });
  if (best) return best;

  // 4) stable
  return codes.slice().sort()[0];
}

// optional tie-break with LLM among fixed candidates
async function tieBreakWithLLM(aiName, candidateCodes, codeToName) {
  if (!process.env.GEMINI_API_KEY || candidateCodes.length < 2) return candidateCodes[0];
  const payload = candidateCodes.map(c => ({ code: c, name: codeToName[c] || '' }));
  const prompt = `
בחר קוד אחד שמתאים ביותר ל: "${aiName}"
בחר אך ורק מתוך:
${JSON.stringify(payload)}
ענה בפורמט JSON: {"code":"..."}
`;
  try {
    const r = await aiClient.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      generationConfig: { temperature: 0 }
    });
    const m = r?.text?.match(/"code"\s*:\s*"([^"]+)"/);
    const chosen = m && m[1];
    return candidateCodes.includes(chosen) ? chosen : candidateCodes[0];
  } catch {
    return candidateCodes[0];
  }
}

// resolve AI name -> best code (exact, canonical, tie-break)
async function resolveNameToBestCode(aiName, ctx) {
  const { currentCodes, userScores, lastTimes, globalCounts, nameToCode, canonicalToCodes, codeToName } = ctx;

  const exact = nameToCode.get(normName(aiName));
  if (exact && !currentCodes.has(exact)) return exact;

  const bucket = canonicalToCodes.get(canonicalKey(aiName)) || [];
  const candidates = bucket.filter(code => !currentCodes.has(code));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const picked = chooseBestSKU(candidates, { userScores, lastTimes, globalCounts });
  if (!picked) return null;

  // simple check for ties on the three metrics
  const topPersonal = Math.max(...candidates.map(c => userScores[c] || 0));
  const samePersonal = candidates.filter(c => (userScores[c] || 0) === topPersonal);
  if (topPersonal > 0 && samePersonal.length === 1) return picked;

  const topTime = Math.max(...candidates.map(c => lastTimes[c] || -1));
  const sameTime = candidates.filter(c => (lastTimes[c] || -1) === topTime);
  if (topTime > 0 && sameTime.length === 1) return picked;

  const topGlob = Math.max(...candidates.map(c => globalCounts[c] || 0));
  const sameGlob = candidates.filter(c => (globalCounts[c] || 0) === topGlob);
  if (sameGlob.length === 1) return picked;

  // tie-break via LLM on the fixed candidate set
  return await tieBreakWithLLM(aiName, candidates, codeToName);
}

// AI suggestions → mapped codes
async function getAISuggestions(topHistory, currentNames, topN, ctx) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('Gemini API key not configured');
    return [];
  }
  try {
    const prompt = `
Here is your purchase history (your 5 most frequent items):
${topHistory.join(', ')}.

Here is your current shopping list:
${currentNames.join(', ')}.

Using both, suggest ${Math.max(topN * 2, 10)} additional grocery item NAMES in Hebrew only.
For each, include a brief reason in Hebrew why it fits your history and/or this list.
Format as a JSON array of objects, e.g.:
[
  { "name": "name", "reason": "reason" }
]
`;
    const aiPromise = aiClient.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      generationConfig: { temperature: 0.2 }
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI request timeout')), CONSTANTS.AI_TIMEOUT)
    );
    const aiResponse = await Promise.race([aiPromise, timeoutPromise]);

    if (aiResponse?.text) {
      const aiObjs = extractJsonArray(aiResponse.text);
      const aiCandidates = [];
      for (let i = 0; i < aiObjs.length; i++) {
        const obj = aiObjs[i] || {};
        const rawName = obj.name;
        const reason = obj.reason;
        if (!rawName || !reason) continue;

        const code = await resolveNameToBestCode(String(rawName).trim(), ctx);
        if (!code || ctx.currentCodes.has(code)) continue;

        aiCandidates.push({
          code,
          score: Math.max(topN * 2, 10) - i,
          method: 'ai',
          suggestionName: String(rawName).trim(),
          suggestionReason: String(reason).trim()
        });
      }
      return aiCandidates.filter(c => c.score >= CONSTANTS.MIN_AI_SCORE);
    }
  } catch (e) {
    console.warn('Gemini AI failed:', e.message);
  }
  return [];
}

// ensure non-AI coverage
function ensureMethodAvailability(pools, globalCounts, currentCodes) {
  const NON_AI_METHODS = ['habit', 'co', 'cf', 'personal'];
  const availableGlobal = Object.entries(globalCounts)
    .filter(([code]) => !currentCodes.has(code))
    .sort(([, a], [, b]) => b - a);

  NON_AI_METHODS.forEach(method => {
    if (!pools[method] || pools[method].length === 0) {
      let slice, methodName;
      switch (method) {
        case 'personal': slice = availableGlobal.slice(0, Math.min(5, availableGlobal.length)); methodName = 'personal'; break;
        case 'co':       slice = availableGlobal.slice(0, Math.min(3, availableGlobal.length)); methodName = 'co'; break;
        case 'cf':       slice = availableGlobal.slice(Math.min(5, availableGlobal.length), Math.min(8, availableGlobal.length)); methodName = 'cf'; break;
        case 'habit':    slice = availableGlobal.slice(Math.min(8, availableGlobal.length), Math.min(10, availableGlobal.length)); methodName = 'habit'; break;
      }
      pools[method] = slice.map(([code], i) => ({ code, score: slice.length - i, method: methodName }));
    }
  });
}

// diversify main
function guaranteeMethodDiversity(pools, topN) {
  const NON_AI_METHODS = ['habit', 'co', 'cf', 'personal'];
  const final = [];
  const used = new Set();

  const aiPool = pools.ai || [];
  if (aiPool.length > 0 && !used.has(aiPool[0].code)) {
    used.add(aiPool[0].code);
    final.push(aiPool[0]);
  }

  NON_AI_METHODS.forEach(method => {
    if (final.length >= topN) return;
    const pool = pools[method] || [];
    for (const c of pool) {
      if (!used.has(c.code)) {
        used.add(c.code);
        final.push(c);
        break;
      }
    }
  });

  const allRemaining = [];
  Object.values(pools).forEach(pool => {
    pool.forEach(c => { if (!used.has(c.code)) allRemaining.push(c); });
  });

  allRemaining.sort((a, b) => b.score - a.score).forEach(c => {
    if (final.length < topN && !used.has(c.code)) {
      used.add(c.code);
      final.push(c);
    }
  });

  if (final.length > topN) final.length = topN;
  return final;
}

module.exports = {
  recommend: async (userId, currentProducts, purchaseHistory, topN = 5, showAllAI = false) => {
    try {
      validateInputs(userId, currentProducts, purchaseHistory, topN);

      const now = new Date();
      const todayWd = now.getDay();
      const currentCodes = new Set(currentProducts.map(p => p.product?.itemCode).filter(Boolean));

      // load catalog + indexes
      let allProds;
      try {
        allProds = await ProductModel.find().lean();
      } catch (e) {
        console.error('Error loading product catalog:', e.message);
        return showAllAI ? { main: [], supplementaryAI: [], supplementaryOther: [], totalAIGenerated: 0, aiUsedInMain: 0 } : [];
      }

      const nameToCode = new Map();
      const canonicalToCodes = new Map();
      const codeToName = {};
      allProds.forEach(p => {
        const id = String(p._id);
        const n = normName(p.name);
        const c = canonicalKey(p.name);
        if (n) nameToCode.set(n, id);
        if (c) {
          if (!canonicalToCodes.has(c)) canonicalToCodes.set(c, []);
          canonicalToCodes.get(c).push(id);
        }
        if (p.name) codeToName[id] = p.name.trim();
      });

      const currentNames = currentProducts.map(p => p.product?.name?.trim()).filter(Boolean);

      // last purchase times per code
      const lastTimes = {};
      purchaseHistory.forEach(b => {
        const t = new Date(b.timeStamp).getTime();
        b.products?.forEach(p => {
          const code = p.product?.itemCode;
          if (!code) return;
          if (!lastTimes[code] || t > lastTimes[code]) lastTimes[code] = t;
        });
      });

      // methods
      const userScores = calculateRecencyFrequencyScores(purchaseHistory, now);
      const habitCandidates = detectHabits(purchaseHistory, todayWd, currentCodes);
      const coCandidates = findCoOccurrenceCandidates(purchaseHistory, currentCodes, userScores);
      const cfCandidates = await calculateCollaborativeFiltering(purchaseHistory, userId, currentCodes);

      const personalCandidates = Object.entries(userScores)
        .filter(([code]) => !currentCodes.has(code))
        .map(([code, score]) => ({ code, score, method: 'personal' }));

      // popularity
      const { counts: globalCounts, maxCount } = await getGlobalPopularity();
      const boostedCo = applyGlobalBoost(coCandidates, globalCounts, maxCount);
      const boostedPersonal = applyGlobalBoost(personalCandidates, globalCounts, maxCount);

      const pools = {
        habit: habitCandidates.sort((a, b) => b.score - a.score),
        co: boostedCo.sort((a, b) => b.score - a.score),
        cf: cfCandidates.sort((a, b) => b.score - a.score),
        personal: boostedPersonal.sort((a, b) => b.score - a.score)
      };

      // AI (map names to codes via resolver)
      const topHistory = Object.entries(userScores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([code]) => codeToName[code])
        .filter(Boolean);

      const ctx = { currentCodes, userScores, lastTimes, globalCounts, nameToCode, canonicalToCodes, codeToName };
      const aiCandidates = await getAISuggestions(topHistory, currentNames, topN, ctx);
      if (aiCandidates.length > 0) pools.ai = aiCandidates;

      // coverage + diversity
      ensureMethodAvailability(pools, globalCounts, currentCodes);
      const final = guaranteeMethodDiversity(pools, topN);

      // format
      const formatRecommendation = (item) => {
        const dates = purchaseHistory
          .filter(b => b.products?.some(p => p.product?.itemCode === item.code))
          .map(b => {
            const d = new Date(b.timeStamp);
            return isNaN(d.getTime()) ? null : d.getTime();
          })
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

      if (showAllAI) {
        const usedCodes = new Set(final.map(i => i.code));
        const usedSupp = new Set(usedCodes);

        const supplementaryAI = [];
        for (const aiItem of (pools.ai || [])) {
          if (usedSupp.has(aiItem.code)) continue;
          supplementaryAI.push({ ...aiItem, isSupplementary: true });
          usedSupp.add(aiItem.code);
        }

        const supplementaryOther = [];
        const perMethodCap = 3;
        const caps = { habit: 0, co: 0, cf: 0, personal: 0 };
        for (const method of ['habit', 'co', 'cf', 'personal']) {
          const pool = pools[method] || [];
          for (const item of pool) {
            if (caps[method] >= perMethodCap) break;
            if (usedSupp.has(item.code)) continue;
            supplementaryOther.push({ ...item, isSupplementary: true });
            usedSupp.add(item.code);
            caps[method] += 1;
          }
        }

        return {
          main: final.map(formatRecommendation),
          supplementaryAI: supplementaryAI.map(formatRecommendation),
          supplementaryOther: supplementaryOther.map(formatRecommendation),
          totalAIGenerated: (pools.ai || []).length,
          aiUsedInMain: final.filter(x => x.method === 'ai').length,
          totalSupplementaryAI: supplementaryAI.length,
          totalSupplementaryOther: supplementaryOther.length
        };
      } else {
        return final.map(formatRecommendation);
      }
    } catch (e) {
      console.error('Recommendation system error:', e.message);
      return showAllAI ? { main: [], supplementaryAI: [], supplementaryOther: [], totalAIGenerated: 0, aiUsedInMain: 0 } : [];
    }
  }
};
