// Jest globalSetup: spin up ONE MongoMemoryServer for the whole test run and
// expose its URI to all test files via env var. Per-file beforeAll then just
// connects mongoose to this single URI — no per-file server starts (which
// previously caused intermittent ECONNRESET when one file's teardown raced
// the next file's connect).

const { MongoMemoryServer } = require('mongodb-memory-server')

module.exports = async () => {
  const mongo = await MongoMemoryServer.create()
  process.env.__MONGO_TEST_URI__ = mongo.getUri()
  // Stash the server instance on globalThis so globalTeardown can stop it.
  globalThis.__MONGO_MEMORY_SERVER__ = mongo
}
