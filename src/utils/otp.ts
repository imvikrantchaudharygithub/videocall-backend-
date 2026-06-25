import twilio from 'twilio';
import { ENV } from '../config/env';

const client = twilio(ENV.TWILIO_ACCOUNT_SID, ENV.TWILIO_AUTH_TOKEN);

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOTP = async (phone: string, otp: string): Promise<boolean> => {
  try {
    if (ENV.NODE_ENV === 'development') {
      console.log(`[DEV] OTP for ${phone}: ${otp}`);
      return true;
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
