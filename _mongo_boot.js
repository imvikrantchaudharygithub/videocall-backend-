const { MongoMemoryServer } = require('mongodb-memory-server');
(async () => {
  const mongo = await MongoMemoryServer.create({ instance: { port: 27018, dbName: 'companion_call' } });
  console.log('MONGO_READY ' + mongo.getUri());
  process.on('SIGTERM', async () => { await mongo.stop(); process.exit(0); });
  setInterval(() => {}, 1 << 30); // keep alive
})().catch(e => { console.error('MONGO_BOOT_FAIL', e); process.exit(1); });
