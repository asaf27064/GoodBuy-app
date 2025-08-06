// AI: prompt + name→code mapping (with tie-break & debug)
const { GoogleGenAI } = require('@google/genai');
const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Normalize helpers (local)
function normName(s) {
  return s?.trim().replace(/\s+/g, ' ').replace(/[״"]/g, '').toLowerCase();
}
function canonicalKey(s) {
  let x = normName(s);
  x = x.replace(/\d+([.,]\d+)?\s*(קג|ק\"ג|קילו|גר?ם|ג\'|ml|מ\"ל|מיליליטר|ליטר|יחידות?|גלילים?|חבילות?)/g, '');
  x = x.replace(/\d+([.,]\d+)?/g, '');
  x = x.replace(/[()\-+*/.,:;'"!?]/g, ' ');
  x = x.replace(/\s+/g, ' ').trim();
  return x;
}

// LLM JSON array extractor
function extractJsonArray(rawText) {
  if (!rawText || typeof rawText !== 'string') throw new Error('Invalid AI response');
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const m = cleaned.match(/\[([\s\S]*?)\]/m);
  if (!m) throw new Error('No JSON array found');
  const arr = JSON.parse(m[0]);
  if (!Array.isArray(arr)) throw new Error('Not array');
  return arr;
}

// Choose best SKU from a list of codes
function chooseBestSKU(codes, { userScores, lastTimes, globalCounts }) {
  if (!codes?.length) return null;
  let best = null, bestScore = -1;
  codes.forEach(code => { const s = userScores[code] || 0; if (s > bestScore) { bestScore = s; best = code; } });
  if (bestScore > 0) return best;
  best = null; let bestTime = -1;
  codes.forEach(code => { const t = lastTimes[code] || -1; if (t > bestTime) { bestTime = t; best = code; } });
  if (bestTime > 0) return best;
  best = null; bestScore = -1;
  codes.forEach(code => { const g = globalCounts[code] || 0; if (g > bestScore) { bestScore = g; best = code; } });
  if (best) return best;
  return codes.slice().sort()[0];
}

// Tie-break among fixed candidates
async function tieBreakWithLLM(aiName, candidateCodes, codeToName) {
  if (!process.env.GEMINI_API_KEY || candidateCodes.length < 2) return { code: candidateCodes[0], by: 'rule' };
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
    return candidateCodes.includes(chosen) ? { code: chosen, by: 'llm' } : { code: candidateCodes[0], by: 'rule' };
  } catch {
    return { code: candidateCodes[0], by: 'rule' };
  }
}

// Resolve AI name -> best code
async function resolveNameToBestCode(aiName, ctx) {
  const { currentCodes, userScores, lastTimes, globalCounts, nameToCode, canonicalToCodes, codeToName } = ctx;

  const exact = nameToCode.get(normName(aiName));
  if (exact && !currentCodes.has(exact)) {
    return { code: exact, candidates: [exact], pickedBy: 'exact', canonical: canonicalKey(aiName) };
  }

  const bucket = canonicalToCodes.get(canonicalKey(aiName)) || [];
  const candidates = bucket.filter(code => !currentCodes.has(code));
  if (candidates.length === 0) return { code: null, candidates: [], pickedBy: 'none', canonical: canonicalKey(aiName) };
  if (candidates.length === 1) return { code: candidates[0], candidates, pickedBy: 'rule', canonical: canonicalKey(aiName) };

  const picked = chooseBestSKU(candidates, { userScores, lastTimes, globalCounts });
  if (!picked) return { code: null, candidates, pickedBy: 'none', canonical: canonicalKey(aiName) };

  const topP = Math.max(...candidates.map(c => userScores[c] || 0));
  const sameP = candidates.filter(c => (userScores[c] || 0) === topP);
  if (topP > 0 && sameP.length === 1) return { code: picked, candidates, pickedBy: 'rule', canonical: canonicalKey(aiName) };

  const topT = Math.max(...candidates.map(c => lastTimes[c] || -1));
  const sameT = candidates.filter(c => (lastTimes[c] || -1) === topT);
  if (topT > 0 && sameT.length === 1) return { code: picked, candidates, pickedBy: 'rule', canonical: canonicalKey(aiName) };

  const topG = Math.max(...candidates.map(c => globalCounts[c] || 0));
  const sameG = candidates.filter(c => (globalCounts[c] || 0) === topG);
  if (sameG.length === 1) return { code: picked, candidates, pickedBy: 'rule', canonical: canonicalKey(aiName) };

  const tb = await tieBreakWithLLM(aiName, candidates, codeToName);
  return { code: tb.code, candidates, pickedBy: tb.by, canonical: canonicalKey(aiName) };
}

// ask LLM + map names to codes
async function getAISuggestions(topHistory, currentNames, topN, ctx, C) {
  if (!process.env.GEMINI_API_KEY) return [];
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
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('AI request timeout')), C.AI_TIMEOUT));
  const aiResponse = await Promise.race([aiPromise, timeout]).catch(() => null);
  if (!aiResponse?.text) return [];

  if (ctx.debug) ctx.debug.ai = { rawText: aiResponse.text, suggestions: [] };

  let objs;
  try { objs = extractJsonArray(aiResponse.text); } catch { return []; }

  const out = [];
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i] || {};
    if (!o.name || !o.reason) continue;
    const resolved = await resolveNameToBestCode(String(o.name).trim(), ctx);
    if (ctx.debug) ctx.debug.ai.suggestions.push({
      name: String(o.name).trim(),
      reason: String(o.reason).trim(),
      canonical: resolved.canonical,
      candidates: resolved.candidates,
      pickedCode: resolved.code,
      pickedBy: resolved.pickedBy
    });
    if (!resolved.code || ctx.currentCodes.has(resolved.code)) continue;
    out.push({
      code: resolved.code,
      score: Math.max(topN * 2, 10) - i,
      method: 'ai',
      suggestionName: String(o.name).trim(),
      suggestionReason: String(o.reason).trim()
    });
  }
  return out.filter(x => x.score >= C.MIN_AI_SCORE);
}

module.exports = { getAISuggestions };
