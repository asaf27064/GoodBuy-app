const { GoogleGenAI } = require('@google/genai');
const PurchaseModel = require('../models/purchaseModel');
const ProductModel = require('../models/productModel');

const aiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// Constants
const CONSTANTS = {
  DECAY_LAMBDA: 0.000001,
  MIN_HABITS: 2,
  CO_OCCURRENCE_ALPHA: 0.5,
  SIMILAR_USERS_LIMIT: 10,
  GLOBAL_BOOST_RATIO: 0.1,
  AI_TIMEOUT: 10000,
  MIN_AI_SCORE: 1,
  GUARANTEED_METHODS: ['ai', 'co', 'personal', 'cf', 'habit']
};

/**
 * Safely extracts JSON array from AI response text
 */
function extractJsonArray(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Invalid AI response: empty or non-string response');
  }

  try {
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\[([\s\S]*?)\]/m);
    if (!match) {
      throw new Error('No JSON array found in AI response');
    }

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) {
      throw new Error('Parsed result is not an array');
    }

    return parsed;
  } catch (error) {
    console.error('JSON parsing error:', error.message);
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
}

/**
 * Validates input parameters
 */
function validateInputs(userId, currentProducts, purchaseHistory, topN) {
  if (!userId) throw new Error('userId is required');
  if (!Array.isArray(currentProducts)) throw new Error('currentProducts must be an array');
  if (!Array.isArray(purchaseHistory)) throw new Error('purchaseHistory must be an array');
  if (!Number.isInteger(topN) || topN < 1) throw new Error('topN must be a positive integer');
}

/**
 * Calculates recency-frequency scores for products
 */
function calculateRecencyFrequencyScores(purchaseHistory, now) {
  const userScores = {};
  const { DECAY_LAMBDA } = CONSTANTS;

  purchaseHistory.forEach(purchase => {
    try {
      const purchaseDate = new Date(purchase.timeStamp);
      if (isNaN(purchaseDate.getTime())) return;

      const age = Math.max(0, now.getTime() - purchaseDate.getTime());
      const decay = Math.exp(-CONSTANTS.DECAY_LAMBDA * age);

      purchase.products?.forEach(({ product, numUnits }) => {
        if (!product?.itemCode) return;
        
        const code = product.itemCode;
        const units = Math.max(1, Number(numUnits) || 1);
        userScores[code] = (userScores[code] || 0) + decay * units;
      });
    } catch (error) {
      console.warn('Error processing purchase:', error.message);
    }
  });

  return userScores;
}

/**
 * Detects user habits based on weekday patterns
 */
function detectHabits(purchaseHistory, todayWd, currentCodes) {
  const weekdayCounts = {};
  const { MIN_HABITS } = CONSTANTS;

  purchaseHistory.forEach(purchase => {
    try {
      const purchaseDate = new Date(purchase.timeStamp);
      if (isNaN(purchaseDate.getTime())) return;

      const wd = purchaseDate.getDay();
      purchase.products?.forEach(({ product }) => {
        if (!product?.itemCode) return;
        
        const code = product.itemCode;
        weekdayCounts[code] = weekdayCounts[code] || {};
        weekdayCounts[code][wd] = (weekdayCounts[code][wd] || 0) + 1;
      });
    } catch (error) {
      console.warn('Error processing habit detection:', error.message);
    }
  });

  // habit - include items with pattern on any day if today fails
  let candidates = Object.entries(weekdayCounts)
    .filter(([code, counts]) =>
      !currentCodes.has(code) && (counts[todayWd] || 0) >= MIN_HABITS
    )
    .map(([code, counts]) => ({
      code,
      score: counts[todayWd],
      method: 'habit'
    }));

  // If no habits for today, look for strong patterns on other days
  if (candidates.length === 0) {
    candidates = Object.entries(weekdayCounts)
      .filter(([code, counts]) => {
        if (currentCodes.has(code)) return false;
        const maxDayCount = Math.max(...Object.values(counts));
        return maxDayCount >= MIN_HABITS;
      })
      .map(([code, counts]) => {
        const maxDayCount = Math.max(...Object.values(counts));
        return {
          code,
          score: maxDayCount,
          method: 'habit'
        };
      })
      .slice(0, 5); // Limit to top 5
  }

  return candidates;
}

/**
 * Finds co-occurrence candidates
 */
function findCoOccurrenceCandidates(purchaseHistory, currentCodes, userScores) {
  const coCounts = {};
  const { CO_OCCURRENCE_ALPHA } = CONSTANTS;

  purchaseHistory.forEach(purchase => {
    try {
      const codes = purchase.products
        ?.map(p => p.product?.itemCode)
        .filter(Boolean) || [];
      
      // count if ANY item from current list appears
      if (!codes.some(c => currentCodes.has(c))) return;

      codes.forEach(c => {
        if (!currentCodes.has(c)) {
          coCounts[c] = (coCounts[c] || 0) + 1;
        }
      });
    } catch (error) {
      console.warn('Error processing co-occurrence:', error.message);
    }
  });

  return Object.entries(coCounts)
    .filter(([code]) => !currentCodes.has(code))
    .map(([code, co]) => ({
      code,
      score: co * (1 + CO_OCCURRENCE_ALPHA * (userScores[code] || 0)),
      method: 'co'  //
    }));
}

/**
 * Calculates collaborative filtering recommendations - Enhanced
 */
async function calculateCollaborativeFiltering(purchaseHistory, userId, currentCodes) {
  try {
    const userSet = new Set(
      purchaseHistory.flatMap(b => 
        b.products?.map(p => p.product?.itemCode).filter(Boolean) || []
      )
    );

    if (userSet.size === 0) return [];

    const allPurchases = await PurchaseModel.find({
      purchasedBy: { $ne: userId }
    }).lean();

    const userMap = {};
    allPurchases.forEach(purchase => {
      try {
        const uid = purchase.purchasedBy?.toString();
        if (!uid) return;

        userMap[uid] = userMap[uid] || new Set();
        purchase.products?.forEach(p => {
          if (p.product?.itemCode) {
            userMap[uid].add(p.product.itemCode);
          }
        });
      } catch (error) {
        console.warn('Error processing user purchase:', error.message);
      }
    });

    const sims = Object.entries(userMap)
      .map(([uid, set]) => {
        const intersection = [...set].filter(c => userSet.has(c)).length;
        const union = new Set([...set, ...userSet]).size;
        return { uid, sim: union > 0 ? intersection / union : 0 };
      })
      .filter(x => x.sim > 0)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, CONSTANTS.SIMILAR_USERS_LIMIT);

    const cfScores = {};
    sims.forEach(({ uid, sim }) => {
      userMap[uid].forEach(code => {
        if (!currentCodes.has(code)) {
          cfScores[code] = (cfScores[code] || 0) + sim;
        }
      });
    });

    return Object.entries(cfScores)
      .map(([code, score]) => ({ code, score, method: 'cf' }));
  } catch (error) {
    console.error('Collaborative filtering error:', error.message);
    return [];
  }
}

/**
 * Gets global popularity scores for products
 */
async function getGlobalPopularity() {
  try {
    const globalAgg = await PurchaseModel.aggregate([
      { $unwind: '$products' },
      { 
        $group: { 
          _id: '$products.product.itemCode', 
          count: { $sum: 1 } 
        } 
      }
    ]);

    const maxCount = Math.max(...globalAgg.map(g => g.count), 1);
    return {
      counts: Object.fromEntries(globalAgg.map(g => [g._id, g.count])),
      maxCount
    };
  } catch (error) {
    console.error('Global popularity calculation error:', error.message);
    return { counts: {}, maxCount: 1 };
  }
}

/**
 * Applies global popularity boost to candidates
 */
function applyGlobalBoost(candidates, globalCounts, maxCount) {
  const { GLOBAL_BOOST_RATIO } = CONSTANTS;
  
  return candidates.map(item => ({
    ...item,
    score: item.score + 
      ((globalCounts[item.code] || 0) / maxCount) * 
      GLOBAL_BOOST_RATIO * 
      item.score
  }));
}

/**
 * Gets AI suggestions
 */
async function getAISuggestions(topHistory, currentNames, topN, nameToCode, currentCodes) {
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
  { "name": "name", "reason": "reason" },
  …
]
`;

    const aiPromise = aiClient.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI request timeout')), CONSTANTS.AI_TIMEOUT)
    );

    const aiResponse = await Promise.race([aiPromise, timeoutPromise]);
    
    if (aiResponse?.text) {
      console.log('💡 Gemini raw response.text:', aiResponse.text);
      const aiObjs = extractJsonArray(aiResponse.text);
      
      const aiCandidates = aiObjs
        .map(({ name, reason }, i) => {
          if (!name || !reason) return null;
          
          const trimmedName = name.trim();
          const code = nameToCode[trimmedName];
          
          if (!code || currentCodes.has(code)) return null;
          
          return {
            code,
            score: Math.max(topN * 2, 10) - i,
            method: 'ai',
            suggestionName: trimmedName,
            suggestionReason: reason.trim()
          };
        })
        .filter(c => c && c.score >= CONSTANTS.MIN_AI_SCORE);

      console.log(`✅ Gemini AI suggestions: ${aiCandidates.length} items`);
      return aiCandidates;
    }
  } catch (error) {
    console.warn('Gemini AI failed:', error.message);
  }

  console.log('❌ No AI suggestions available');
  return [];
}

/**
 * Ensures each non-AI method has at least one candidate
 */
function ensureMethodAvailability(pools, globalCounts, currentCodes) {
  const NON_AI_METHODS = ['habit', 'co', 'cf', 'personal'];
  
  // Get available global products once for efficiency
  const availableGlobal = Object.entries(globalCounts)
    .filter(([code]) => !currentCodes.has(code))
    .sort(([,a], [,b]) => b - a);
  
  NON_AI_METHODS.forEach(method => {
    if (!pools[method] || pools[method].length === 0) {
      console.log(`🔧 Generating fallback for method: ${method}`);
      
      // Take different slices for variety
      let slice, methodName;
      switch (method) {
        case 'personal':
          slice = availableGlobal.slice(0, Math.min(5, availableGlobal.length));
          methodName = 'personal';
          break;
        case 'co':
          slice = availableGlobal.slice(0, Math.min(3, availableGlobal.length));
          methodName = 'co';
          break;
        case 'cf':
          slice = availableGlobal.slice(Math.min(5, availableGlobal.length), Math.min(8, availableGlobal.length));
          methodName = 'cf';
          break;
        case 'habit':
          slice = availableGlobal.slice(Math.min(8, availableGlobal.length), Math.min(10, availableGlobal.length));
          methodName = 'habit';
          break;
      }
      
      pools[method] = slice.map(([code], i) => ({
        code,
        score: slice.length - i,
        method: methodName
      }));
    }
  });
}

/**
 * Guaranteed method diversity - ensures at least one from each non-AI method + AI separately
 */
function guaranteeMethodDiversity(pools, topN) {
  const NON_AI_METHODS = ['habit', 'co', 'cf', 'personal'];
  const final = [];
  const used = new Set();
  
  // Add one AI suggestion
  const aiPool = pools.ai || [];
  if (aiPool.length > 0) {
    const aiCandidate = aiPool[0];
    if (!used.has(aiCandidate.code)) {
      used.add(aiCandidate.code);
      final.push(aiCandidate);
    }
  }

  // Second: Get one from each non-AI method
  NON_AI_METHODS.forEach(method => {
    if (final.length >= topN) return;
    
    const pool = pools[method] || [];
    for (const candidate of pool) {
      if (!used.has(candidate.code)) {
        used.add(candidate.code);
        final.push(candidate);
        break;
      }
    }
  });

  // Third: Fill remaining slots with best remaining candidates from all methods
  const allRemaining = [];
  Object.values(pools).forEach(pool => {
    pool.forEach(candidate => {
      if (!used.has(candidate.code)) {
        allRemaining.push(candidate);
      }
    });
  });

  // Sort by score and fill remaining slots
  allRemaining
    .sort((a, b) => b.score - a.score)
    .forEach(candidate => {
      if (final.length < topN && !used.has(candidate.code)) {
        used.add(candidate.code);
        final.push(candidate);
      }
    });

  if (final.length > topN) {
    final.length = topN;
  }

  return final;
}

module.exports = {
  recommend: async (userId, currentProducts, purchaseHistory, topN = 5, showAllAI = false) => {
    try {
      validateInputs(userId, currentProducts, purchaseHistory, topN);

      const now = new Date();
      const todayWd = now.getDay();
      const currentCodes = new Set(
        currentProducts
          .map(p => p.product?.itemCode)
          .filter(Boolean)
      );

      // Load product catalog
      let allProds, nameToCode, codeToName;
      try {
        allProds = await ProductModel.find().lean();
        nameToCode = Object.fromEntries(
          allProds.map(p => [p.name?.trim(), p._id?.toString()]).filter(([name, id]) => name && id)
        );
        codeToName = Object.fromEntries(
          allProds.map(p => [p._id?.toString(), p.name?.trim()]).filter(([id, name]) => id && name)
        );
      } catch (error) {
        console.error('Error loading product catalog:', error.message);
        return showAllAI ? { main: [], supplementaryAI: [], totalAIGenerated: 0, aiUsedInMain: 0 } : [];
      }

      const currentNames = currentProducts
        .map(p => p.product?.name?.trim())
        .filter(Boolean);

      // Calculate recommendation methods
      const userScores = calculateRecencyFrequencyScores(purchaseHistory, now);
      const habitCandidates = detectHabits(purchaseHistory, todayWd, currentCodes);
      const coCandidates = findCoOccurrenceCandidates(purchaseHistory, currentCodes, userScores);
      const cfCandidates = await calculateCollaborativeFiltering(purchaseHistory, userId, currentCodes);
      
      const personalCandidates = Object.entries(userScores)
        .filter(([code]) => !currentCodes.has(code))
        .map(([code, score]) => ({ code, score, method: 'personal' }));

      // Get global popularity and apply boost
      const { counts: globalCounts, maxCount } = await getGlobalPopularity();
      const boostedCo = applyGlobalBoost(coCandidates, globalCounts, maxCount);
      const boostedPersonal = applyGlobalBoost(personalCandidates, globalCounts, maxCount);

      // Prepare candidate pools
      const pools = {
        habit: habitCandidates.sort((a, b) => b.score - a.score),
        co: boostedCo.sort((a, b) => b.score - a.score),
        cf: cfCandidates.sort((a, b) => b.score - a.score),
        personal: boostedPersonal.sort((a, b) => b.score - a.score)
      };

      // Get AI suggestions
      const topHistory = Object.entries(userScores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([code]) => codeToName[code])
        .filter(Boolean);

      const aiCandidates = await getAISuggestions(
        topHistory, currentNames, topN, nameToCode, currentCodes
      );

      // AI is handled separately
      if (aiCandidates.length > 0) {
        pools.ai = aiCandidates;
        console.log(`✅ AI suggestions: ${aiCandidates.length} items`);
      } else {
        console.log('❌ No AI suggestions available');
      }

      // Ensure non-AI methods have candidates
      ensureMethodAvailability(pools, globalCounts, currentCodes);

      // Guarantee method diversity (AI + one from each other method)
      const final = guaranteeMethodDiversity(pools, topN);

      // Format output
      const formatRecommendation = (item) => {
        const dates = purchaseHistory
          .filter(b => b.products?.some(p => p.product?.itemCode === item.code))
          .map(b => {
            const date = new Date(b.timeStamp);
            return isNaN(date.getTime()) ? null : date.getTime();
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
        const usedCodes = new Set(final.map(item => item.code));
        
        // Separate AI and non-AI supplementary items
        const supplementaryAI = (pools.ai || [])
          .filter(aiItem => !usedCodes.has(aiItem.code))
          .map(aiItem => ({ ...aiItem, isSupplementary: true }));

        const supplementaryOther = [];
        ['habit', 'co', 'cf', 'personal'].forEach(method => {
          const methodItems = (pools[method] || [])
            .filter(item => !usedCodes.has(item.code))
            .slice(0, 3) // Limit per method
            .map(item => ({ ...item, isSupplementary: true }));
          supplementaryOther.push(...methodItems);
        });

        return {
          main: final.map(formatRecommendation),
          supplementaryAI: supplementaryAI.map(formatRecommendation),
          supplementaryOther: supplementaryOther.map(formatRecommendation),
          totalAIGenerated: aiCandidates.length,
          aiUsedInMain: final.filter(item => item.method === 'ai').length,
          totalSupplementaryAI: supplementaryAI.length,
          totalSupplementaryOther: supplementaryOther.length
        };
      } else {
        return final.map(formatRecommendation);
      }

    } catch (error) {
      console.error('Recommendation system error:', error.message);
      return showAllAI ? { main: [], supplementaryAI: [], totalAIGenerated: 0, aiUsedInMain: 0 } : [];
    }
  }
};