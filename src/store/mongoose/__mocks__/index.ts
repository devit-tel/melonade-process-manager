import { MongoMemoryServer } from 'mongodb-memory-server';

if (!process.env['MONGODB_URI']) {
  new MongoMemoryServer({
    instance: {
      port: 51553,
      dbName: 'melonade-test',
      debug: true,
    },
  });
}

// afterAll(() => {
//   mongod.stop();
// });
