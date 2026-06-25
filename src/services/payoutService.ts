import axios from 'axios';
import { ENV } from '../config/env';
import { HostProfile } from '../models/hostProfile.model';
import mongoose from 'mongoose';

const razorpayPayoutClient = axios.create({
  baseURL: 'https://api.razorpay.com/v1',
  auth: {
    username: ENV.RAZORPAY_PAYOUT_KEY,
    password: ENV.RAZORPAY_PAYOUT_SECRET,
  },
  headers: { 'Content-Type': 'application/json' },
});

export const createRazorpayPayout = async (
  hostId: mongoose.Types.ObjectId,
  amountInr: number,
  method: 'bank_transfer' | 'upi',
  withdrawalId: string
): Promise<{ success: boolean; payoutId?: string; error?: string }> => {
  try {
    const hostProfile = await HostProfile.findOne({ userId: hostId });
    if (!hostProfile?.bankDetails) {
      return { success: false, error: 'Host bank details not found' };
    }

    const { bankDetails } = hostProfile;

    let fundAccount: Record<string, unknown>;

    if (method === 'upi' && bankDetails.upiId) {
      fundAccount = {
        account_type: 'vpa',
        vpa: { address: bankDetails.upiId },
      };
    } else {
      if (!bankDetails.accountNumber || !bankDetails.ifscCode) {
        return { success: false, error: 'Incomplete bank details' };
      }
      fundAccount = {
        account_type: 'bank_account',
        bank_account: {
          name: bankDetails.accountHolderName || 'Host',
          ifsc: bankDetails.ifscCode,
          account_number: bankDetails.accountNumber,
        },
      };
    }

    // Create contact
    const contactRes = await razorpayPayoutClient.post('/contacts', {
      name: bankDetails.accountHolderName || 'Host',
      type: 'vendor',
      reference_id: hostId.toString(),
    });

    // Create fund account
    const fundAccountRes = await razorpayPayoutClient.post('/fund_accounts', {
      contact_id: contactRes.data.id,
      ...fundAccount,
    });

    // Create payout
    const payoutRes = await razorpayPayoutClient.post('/payouts', {
      account_number: ENV.RAZORPAY_PAYOUT_ACCOUNT_NUMBER,
      fund_account_id: fundAccountRes.data.id,
      amount: amountInr * 100, // paise
      currency: 'INR',
      mode: method === 'upi' ? 'UPI' : 'NEFT',
      purpose: 'payout',
      reference_id: withdrawalId,
      narration: 'CompanionCall Host Earnings',
    });

    return { success: true, payoutId: payoutRes.data.id };
  } catch (error: any) {
    console.error('Razorpay Payout error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.description || 'Payout failed',
    };
  }
};
