# CLAUDE.md

Instructions for Claude when working on GoodBuy. Read this before touching code.

---

## What this project is

**GoodBuy** is a full-stack grocery price-comparison + collaborative shopping
platform for the Israeli market. Three logical pieces:

- **API** — Node 22 / Express 5 / MongoDB (Mongoose). Auth, shopping lists,
  recommendations. Lives in `backend/src/`. Entry: `server.js` → builds the
  Express app from `app.js` and starts the listener.
- **Worker** — separate Node process at `backend/src/jobs/worker.js`. Runs
  the price-scraping pipeline (Puppeteer + FTP + XML) on a 05:30 daily cron
  and on demand. **Strict isolation from the API** — the API just writes
  `requestedAt` to a SystemMeta doc; the worker polls and executes. A memory
  spike in the scraper cannot freeze user requests.
- **Mobile** — React Native / Expo SDK 53. Lives in `mobile-app/src/`. RTL
  Hebrew UI by default.

The three communicate via MongoDB + Socket.IO (real-time list collaboration).

---

## Interesting technical decisions you should know about

**Recommendation engine** (`backend/src/services/recommendation/`). Hybrid:
recency-frequency, day-of-week habits, co-occurrence, Jaccard CF, plus
Gemini-mediated AI suggestions with rule-based + LLM tie-break. The two
heaviest queries (`loadCatalog`, `getGlobalPopularity`) sit behind a
60-second single-flight TTL cache (`cache.js`) — bursts of N concurrent
recommendation requests collapse to 1 DB hit, verified by tests.

**Refresh-token rotation**. Every call to `/auth/refresh` rotates the
refresh token AND returns the new one. Reusing the previous RT is rejected
and revokes the session. Mobile's axios interceptor persists the rotated
RT transparently.

**Bulk list edits**. `PUT /api/ShoppingLists/:id` collapses N changes
(added/removed/updated) + the editLog push into a single `bulkWrite` —
2 DB round-trips total instead of N+2. `ordered: true` preserves
chronological intent (add-then-remove of the same item still applies).

**Optimistic mobile UI** with snapshot rollback. Create-list and leave-list
update local state immediately and roll back on server error. Same
`pendingMap + snapshot` pattern is used for product edits via the
`listAck` socket event.

**Socket auth + room ACLs**. Sockets without a valid JWT are dropped at
handshake. `joinList` validates membership against the `ShoppingList.members`
array — clients can't snoop on rooms they don't belong to.

**Design system** (`mobile-app/src/theme/tokens.js`). `spacing`, `radius`,
`elevation`, `typography`, `motion` scales. Every screen reads from these
— no magic numbers in StyleSheets.

**i18n** (`mobile-app/src/utils/translations.js`). React provider + hook
with dot-path key lookup and `<NAME>` placeholder interpolation. Both
`heb.json` and `eng.json` are kept at full key parity (currently 131
keys each).

---

## Engineering workflow — non-negotiable

### Branch-per-feature, never on `main`

Every change is a branch off `main`. Branch names are kebab-case and
describe the change, not the area: `pipeline-worker-extraction`,
`recommendation-cache`, `ui-optimistic-create-leave-list`. One PR per
branch. **`main` is always merge-able and CI-green.**

### Surgical changes only

This is a production codebase. Default behaviour:

- **No breaking API changes.** The mobile app is downstream; its contract
  with the backend is sacred.
- **No aggressive refactors.** If a fix needs more than the function it
  lives in, stop and propose a separate branch first.
- **Backwards compatibility for clients.** When the server is extended
  (e.g. RT rotation returning a new field), older clients keep working.
- **Errors don't leak internals.** Never return `err.message` to the
  client from a 500. Log it, return a generic message.

### Conventional commits, full-context bodies

Commit subject: a single line, imperative mood, no scope prefix junk.
Body: explain **why** the change is needed, what alternatives were
considered, what is intentionally NOT in this commit. Bullet lists are
fine. Co-authorship trailer is acceptable.

### Tests are not optional

- New backend logic → unit tests (Jest, in `backend/src/__tests__/`).
- New endpoints → integration tests via supertest + `mongodb-memory-server`.
- CI runs on Node 20 + 22 matrix. **A red CI blocks merge.**
- `npm test` at the repo root runs the full backend suite.

### When unsure, ask before patching

If a fix needs to touch multiple files / change a contract / drop a
dependency → surface the trade-off explicitly. Don't apply.

---

## Repo layout

```
backend/src/
  app.js                ← Express app construction (tests import this)
  server.js             ← Runtime bootstrap: connect Mongo + listen
  jobs/worker.js        ← Standalone scraping worker process
  routes/               ← Express routers (auth, shoppingList, product, …)
  controllers/          ← Business logic
  models/               ← Mongoose schemas
  services/
    recommendation/     ← engine.js + cache.js + ai.js + index.js
    shoppingListService.js
  middleware/auth.js    ← JWT middleware. req.user = User document.
  utils/tokenService.js ← JWT helpers
  __tests__/            ← Jest. Setup files in __tests__/setup/.

mobile-app/src/
  App.js                ← Provider tree + nav root
  contexts/             ← AuthContext, ToastContext, ListSocketContext, …
  screens/              ← ShoppingLists, EditList, AddItem, History, …
  components/           ← Reusable (Skeleton, ShoppingListScreenItem, …)
  theme/tokens.js       ← Design tokens. New styles MUST use these.
  utils/translations.js ← i18n. useT() hook.
  utils/haptics.js      ← expo-haptics wrapper. App-wide vocabulary.
  strings/locales/      ← heb.json (default), eng.json (parity-enforced)
```

---

## Common commands

```bash
# Local dev — api + worker + mobile concurrently
npm run dev

# Backend tests
npm test

# Just the worker (debug scraper)
npm run dev:worker
```

---

## Invariants — break these and the app silently breaks

- `mongoose` connection is a singleton. Integration tests share ONE
  in-memory Mongo across files via `globalSetup`/`globalTeardown`.
- `global.io` is set in production by `app.attachSockets()` and stubbed
  in tests by `__tests__/setup/testEnv.js`. Controllers that call
  `global.io.to(...).emit(...)` must not crash if it's a stub.
- `heb.json` and `eng.json` MUST stay at key parity. Adding a key to one
  without the other will produce "undefined" in production.
- Optimistic UI placeholders use a `_tmp:` prefix on `_id` and a
  `_isOptimistic: true` flag. Long-press / leave actions must check this
  flag and no-op on optimistic placeholders.
