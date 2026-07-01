import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | undefined;

export const connectTestDB = async (): Promise<void> => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
};

export const clearTestDB = async (): Promise<void> => {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
};

export const closeTestDB = async (): Promise<void> => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
};
