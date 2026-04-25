import {
  createNotificationRecord,
  deactivateDeviceToken,
  findNotificationById,
  findUserById,
  getNotificationStats,
  listActiveDeviceTokensByUser,
  listNotificationsByUser,
  markNotificationStatus,
  upsertUserDeviceToken
} from '../db/store.js';
import { sendFcmMulticast } from './fcm.service.js';

export async function sendNotification({ recipientUserId, type, title, body, payload, channel = 'push', actorUserId }) {
  if (!recipientUserId || !type || !title || !body) {
    throw new Error('recipientUserId, type, title and body are required');
  }
  const recipient = await findUserById(recipientUserId);
  if (!recipient) {
    throw new Error('Recipient user not found');
  }
  const notification = await createNotificationRecord({ recipientUserId, type, title, body, payload, channel, actorUserId });

  const deviceTokens = await listActiveDeviceTokensByUser(recipientUserId);
  const dispatch = await sendFcmMulticast({
    tokens: deviceTokens.map((d) => d.token),
    title,
    body,
    data: {
      type,
      notificationId: notification.id,
      ...(payload || {})
    }
  });

  if (dispatch.results?.length) {
    for (const item of dispatch.results) {
      if (!item.ok && (item.error === 'NotRegistered' || item.error === 'InvalidRegistration')) {
        await deactivateDeviceToken({ userId: recipientUserId, token: item.token, actorUserId });
      }
    }
  }

  if (dispatch.successCount > 0) {
    await markNotificationStatus({
      notificationId: notification.id,
      recipientUserId,
      status: 'delivered',
      actorUserId: actorUserId || 'system'
    });
  }

  return {
    notification: await findNotificationById(notification.id),
    dispatch
  };
}

export async function getMyNotifications({ userId, limit = 100 }) {
  return listNotificationsByUser(userId, limit);
}

export async function acknowledgeNotification({ notificationId, userId, status }) {
  const notification = await findNotificationById(notificationId);
  if (!notification) {
    throw new Error('Notification not found');
  }
  if (notification.recipientUserId !== userId) {
    throw new Error('Forbidden notification access');
  }
  const updated = await markNotificationStatus({
    notificationId,
    recipientUserId: userId,
    status,
    actorUserId: userId
  });
  return updated;
}

export async function getMyNotificationStats(userId) {
  return getNotificationStats({ recipientUserId: userId });
}

export async function getGlobalNotificationStats() {
  return getNotificationStats();
}

export async function registerDeviceToken({ userId, app, platform, token }) {
  if (!app || !platform || !token) {
    throw new Error('app, platform, token are required');
  }
  return upsertUserDeviceToken({ userId, app, platform, token, actorUserId: userId });
}

