import {
  createNotificationRecord,
  deactivateDeviceToken,
  findNotificationById,
  findUserById,
  getNotificationStats,
  listActiveDeviceTokensByUser,
  listNotificationsByUser,
  listUsers,
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

function isSpecificTarget(target) {
  return target === 'specific_user' || target === 'specific_rider' || target === 'specific_driver';
}

async function resolveRecipientIds({ target, recipientUserId }) {
  if (target === 'all_users') {
    const users = await listUsers({ role: null, status: 'active', limit: 10000 });
    return users.map((u) => u.id);
  }
  if (target === 'all_riders') {
    const riders = await listUsers({ role: 'rider', status: 'active', limit: 10000 });
    return riders.map((u) => u.id);
  }
  if (target === 'all_drivers') {
    const drivers = await listUsers({ role: 'driver', status: 'active', limit: 10000 });
    return drivers.map((u) => u.id);
  }
  if (isSpecificTarget(target)) {
    if (!recipientUserId) {
      throw new Error('recipientUserId is required for specific target');
    }
    const user = await findUserById(recipientUserId);
    if (!user) {
      throw new Error('Recipient user not found');
    }
    if (target === 'specific_rider' && user.role !== 'rider') {
      throw new Error('Recipient is not a rider');
    }
    if (target === 'specific_driver' && user.role !== 'driver') {
      throw new Error('Recipient is not a driver');
    }
    return [user.id];
  }
  throw new Error('Invalid target');
}

export async function sendNotificationCampaign({
  target = 'specific_user',
  recipientUserId,
  type,
  title,
  body,
  payload,
  channel = 'push',
  actorUserId
}) {
  if (!type || !title || !body) {
    throw new Error('type, title and body are required');
  }
  const recipientIds = await resolveRecipientIds({ target, recipientUserId });
  if (recipientIds.length === 0) {
    return {
      target,
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
      deliveries: [],
      failures: []
    };
  }
  const deliveries = [];
  const failures = [];
  for (const id of recipientIds) {
    try {
      const result = await sendNotification({
        recipientUserId: id,
        type,
        title,
        body,
        payload,
        channel,
        actorUserId
      });
      deliveries.push({
        recipientUserId: id,
        notificationId: result.notification?.id || null,
        pushSuccessCount: result.dispatch?.successCount || 0
      });
    } catch (error) {
      failures.push({ recipientUserId: id, error: error.message });
    }
  }
  return {
    target,
    totalRecipients: recipientIds.length,
    sentCount: deliveries.length,
    failedCount: failures.length,
    deliveries,
    failures
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

