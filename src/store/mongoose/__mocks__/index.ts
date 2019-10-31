import { MongoMemoryServer } from 'mongodb-memory-server';

new MongoMemoryServer({
  instance: {
    port: 51553,
    dbName: 'melonade-test',
    debug: true,
  },
});

// afterAll(() => {
//   mongod.stop();
// });
