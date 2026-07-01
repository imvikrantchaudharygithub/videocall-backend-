import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || '3000',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // JWT
  SECRET_KEY: process.env.SECRET_KEY || 'fallback_secret_change_in_prod',
  ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY || 'admin_fallback_secret_change_in_prod',
  SESSION_SECRET: process.env.SESSION_SECRET || 'session_secret_change_in_prod',

  // Opt-in only: dev/test no-OTP login. Must be explicitly enabled; disabled by default.
  ENABLE_DEV_LOGIN: process.env.ENABLE_DEV_LOGIN === 'true',

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/companion_call',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Agora
  AGORA_APP_ID: process.env.AGORA_APP_ID || '',
  AGORA_APP_CERTIFICATE: process.env.AGORA_APP_CERTIFICATE || '',

  // Razorpay
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  RAZORPAY_PAYOUT_KEY: process.env.RAZORPAY_PAYOUT_KEY || '',
  RAZORPAY_PAYOUT_SECRET: process.env.RAZORPAY_PAYOUT_SECRET || '',
  RAZORPAY_PAYOUT_ACCOUNT_NUMBER: process.env.RAZORPAY_PAYOUT_ACCOUNT_NUMBER || '',

  // Twilio
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',

  // Firebase
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
};
