// Jest globalTeardown: stop the in-memory MongoDB started by globalSetup.

module.exports = async () => {
  const mongo = globalThis.__MONGO_MEMORY_SERVER__
  if (mongo) await mongo.stop()
}
