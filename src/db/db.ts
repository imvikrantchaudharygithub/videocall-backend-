import mongoose from 'mongoose';
import { ENV } from '../config/env';

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(ENV.MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

export default connectDB;
