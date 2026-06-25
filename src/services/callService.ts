import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { AGORA_CONFIG } from '../config/agora';
import { v4 as uuidv4 } from 'uuid';
import redis from '../config/redis';
import { Call } from '../models/call.model';
import { HostProfile } from '../models/hostProfile.model';
import { CallerWallet } from '../models/callerWallet.model';
import { REDIS_KEYS, MIN_CALL_BILLING_SECONDS } from '../utils/constants';
import mongoose from 'mongoose';

export const generateAgoraToken = (channelName: string, uid: number): string => {
  const expireTime = AGORA_CONFIG.privilegeExpirationInSeconds;
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;

  return RtcTokenBuilder.buildTokenWithUid(
    AGORA_CONFIG.appId,
    AGORA_CONFIG.appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    privilegeExpireTime,
    privilegeExpireTime
  );
};

export const initiateCall = async (
  callerId: mongoose.Types.ObjectId,
  hostId: mongoose.Types.ObjectId,
  callType: 'video' | 'voice'
): Promise<{
  callId: string;
  agoraChannelName: string;
  agoraToken: string;
  ratePerMinute: number;
} | { error: string }> => {
  const hostProfile = await HostProfile.findOne({ userId: hostId });
  if (!hostProfile || !hostProfile.isApproved) return { error: 'HOST_OFFLINE' };
  if (!hostProfile.isOnline) return { error: 'HOST_OFFLINE' };

  const ratePerMinute = callType === 'video'
    ? hostProfile.videoRatePerMin
    : hostProfile.voiceRatePerMin;

  const minCoinsRequired = Math.ceil((MIN_CALL_BILLING_SECONDS / 60) * ratePerMinute);
  const wallet = await CallerWallet.findOne({ userId: callerId });
  if (!wallet || wallet.balanceCoins < minCoinsRequired) {
    return { error: 'INSUFFICIENT_BALANCE' };
  }

  const agoraChannelName = `call_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  // uid 0 = wildcard token; the apps join with their own locally generated uid
  const agoraToken = generateAgoraToken(agoraChannelName, 0);

  const call = await Call.create({
    callerId,
    hostId,
    callType,
    agoraChannel: agoraChannelName,
    status: 'ringing',
    ratePerSecond: ratePerMinute / 60,
    ratePerMinute,
  });

  return {
    callId: call._id.toString(),
    agoraChannelName,
    agoraToken,
    ratePerMinute,
  };
};

export const startBillingSession = async (
  callId: string,
  callerId: string,
  hostId: string,
  ratePerSecond: number
): Promise<void> => {
  const callData = {
    callerId,
    hostId,
    ratePerSecond: ratePerSecond.toString(),
    startTime: Date.now().toString(),
    lastBilledAt: Date.now().toString(),
    totalBilledCoins: '0',
  };
  await redis.hset(REDIS_KEYS.callActive(callId), callData);
  await redis.set(REDIS_KEYS.callBilling(callId), '0');
};

export const endBillingSession = async (callId: string): Promise<void> => {
  await redis.del(REDIS_KEYS.callActive(callId));
  await redis.del(REDIS_KEYS.callBilling(callId));
};
