// setupFilesAfterEnv: runs in every test file after Jest's globals are
// installed. Closes the per-file http.Server and disconnects mongoose at the
// end of the file — without this, Jest holds handles open after the last
// describe and the process never exits naturally.

const mongoose = require('mongoose')
const { closeTestEnv } = require('./testEnv')

afterAll(async () => {
  await closeTestEnv()
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
})
