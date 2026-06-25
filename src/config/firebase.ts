import admin from 'firebase-admin';
import { ENV } from './env';

const hasValidFirebaseCreds =
  ENV.FIREBASE_PROJECT_ID &&
  ENV.FIREBASE_PRIVATE_KEY &&
  !ENV.FIREBASE_PRIVATE_KEY.includes('YOUR_KEY');

if (!admin.apps.length && hasValidFirebaseCreds) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: ENV.FIREBASE_PROJECT_ID,
        privateKey: ENV.FIREBASE_PRIVATE_KEY,
        clientEmail: ENV.FIREBASE_CLIENT_EMAIL,
      }),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (e) {
    console.warn('⚠️ Firebase init skipped:', (e as Error).message);
  }
}

export default admin;
