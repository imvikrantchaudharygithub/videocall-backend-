import admin from '../config/firebase';
import { User } from '../models/user.model';
import { Notification } from '../models/notification.model';
import mongoose from 'mongoose';

export const sendPushNotification = async (
  userId: mongoose.Types.ObjectId,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> => {
  try {
    if (!admin.apps.length) return false;
    const user = await User.findById(userId).select('fcmToken');
    if (!user?.fcmToken) return false;

    await admin.messaging().send({
      token: user.fcmToken,
      notification: { title, body },
      data: data || {},
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'companion_call' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });

    return true;
  } catch (error) {
    console.error('FCM push error:', error);
    return false;
  }
};

export const createNotification = async (
  userId: mongoose.Types.ObjectId,
  title: string,
  body: string,
  type: 'call' | 'system' | 'tier' | 'gift' | 'favourite_online' | 'withdrawal',
  data?: Record<string, unknown>
): Promise<void> => {
  await Notification.create({ userId, title, body, type, data });
  await sendPushNotification(userId, title, body, data as Record<string, string>);
};

export const sendCallIncomingNotification = async (
  hostId: mongoose.Types.ObjectId,
  callerName: string,
  callId: string,
  callType: 'video' | 'voice'
): Promise<void> => {
  if (!admin.apps.length) return;
  const user = await User.findById(hostId).select('fcmToken');
  if (!user?.fcmToken) return;

  await admin.messaging().send({
    token: user.fcmToken,
    notification: {
      title: `Incoming ${callType} call`,
      body: `${callerName} is calling you`,
    },
    data: { callId, callType, type: 'incoming_call' },
    android: {
      priority: 'high',
      notification: {
        sound: 'ringtone',
        channelId: 'incoming_call',
      },
    },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          sound: 'ringtone.caf',
          badge: 1,
          contentAvailable: true,
        },
      },
    },
  });
};
