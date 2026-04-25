import {
  acknowledgeNotification,
  getGlobalNotificationStats,
  getMyNotificationStats,
  getMyNotifications,
  registerDeviceToken,
  sendNotification
} from '../services/notifications.service.js';

export async function sendNotificationController(req, res) {
  try {
    const result = await sendNotification({
      recipientUserId: req.body.recipientUserId,
      type: req.body.type,
      title: req.body.title,
      body: req.body.body,
      payload: req.body.payload,
      channel: req.body.channel,
      actorUserId: req.user.sub
    });
    return res.status(201).json(result);
  } catch (error) {
    if (error.message === 'Recipient user not found') return res.status(404).json({ error: error.message });
    return res.status(400).json({ error: error.message });
  }
}

export async function registerDeviceTokenController(req, res) {
  try {
    const record = await registerDeviceToken({
      userId: req.user.sub,
      app: req.body.app,
      platform: req.body.platform,
      token: req.body.token
    });
    return res.status(201).json(record);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function listMyNotificationsController(req, res) {
  const limit = Number(req.query.limit || 100);
  const notifications = await getMyNotifications({
    userId: req.user.sub,
    limit: Number.isNaN(limit) ? 100 : limit
  });
  return res.json(notifications);
}

export async function markNotificationReceivedController(req, res) {
  try {
    const notification = await acknowledgeNotification({
      notificationId: req.params.notificationId,
      userId: req.user.sub,
      status: 'received'
    });
    return res.json(notification);
  } catch (error) {
    if (error.message === 'Notification not found') return res.status(404).json({ error: error.message });
    if (error.message === 'Forbidden notification access') return res.status(403).json({ error: error.message });
    return res.status(400).json({ error: error.message });
  }
}

export async function markNotificationDeliveredController(req, res) {
  try {
    const notification = await acknowledgeNotification({
      notificationId: req.params.notificationId,
      userId: req.user.sub,
      status: 'delivered'
    });
    return res.json(notification);
  } catch (error) {
    if (error.message === 'Notification not found') return res.status(404).json({ error: error.message });
    if (error.message === 'Forbidden notification access') return res.status(403).json({ error: error.message });
    return res.status(400).json({ error: error.message });
  }
}

export async function markNotificationReadController(req, res) {
  try {
    const notification = await acknowledgeNotification({
      notificationId: req.params.notificationId,
      userId: req.user.sub,
      status: 'read'
    });
    return res.json(notification);
  } catch (error) {
    if (error.message === 'Notification not found') return res.status(404).json({ error: error.message });
    if (error.message === 'Forbidden notification access') return res.status(403).json({ error: error.message });
    return res.status(400).json({ error: error.message });
  }
}

export async function myNotificationStatsController(req, res) {
  return res.json(await getMyNotificationStats(req.user.sub));
}

export async function globalNotificationStatsController(_req, res) {
  return res.json(await getGlobalNotificationStats());
}

