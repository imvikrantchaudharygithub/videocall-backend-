import twilio from 'twilio';
import { ENV } from '../config/env';

// Twilio is optional at boot. Only instantiate with a valid AccountSid (starts
// with "AC") + auth token, otherwise the constructor throws and crashes the server.
const client =
  ENV.TWILIO_ACCOUNT_SID?.startsWith('AC') && ENV.TWILIO_AUTH_TOKEN
    ? twilio(ENV.TWILIO_ACCOUNT_SID, ENV.TWILIO_AUTH_TOKEN)
    : null;

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOTP = async (phone: string, otp: string): Promise<boolean> => {
  try {
    if (ENV.NODE_ENV === 'development') {
      console.log(`[DEV] OTP for ${phone}: ${otp}`);
      return true;
    }

    if (!client) {
      console.warn('⚠️  Twilio not configured — cannot send OTP in production.');
      return false;
    }

    await client.messages.create({
      body: `Your CompanionCall OTP is: ${otp}. Valid for 5 minutes.`,
      from: ENV.TWILIO_PHONE_NUMBER,
      to: phone,
    });
    return true;
  } catch (error) {
    console.error('Twilio SMS error:', error);
    return false;
  }
};
