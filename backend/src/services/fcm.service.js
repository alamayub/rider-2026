import { env } from '../config/env.js';

export async function sendFcmMulticast({ tokens, title, body, data = {} }) {
  const cleaned = (tokens || []).map((t) => String(t || '').trim()).filter(Boolean);
  if (!cleaned.length) {
    return { successCount: 0, failureCount: 0, disabled: false, results: [] };
  }
  if (!env.fcm.enabled || !env.fcm.serverKey) {
    return { successCount: 0, failureCount: cleaned.length, disabled: true, results: cleaned.map((token) => ({ token, ok: false, error: 'FCM disabled' })) };
  }

  const response = await fetch(env.fcm.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `key=${env.fcm.serverKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      registration_ids: cleaned,
      notification: { title, body },
      data
    })
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      successCount: 0,
      failureCount: cleaned.length,
      disabled: false,
      results: cleaned.map((token) => ({ token, ok: false, error: text || `HTTP ${response.status}` }))
    };
  }

  const payload = await response.json();
  const results = (payload.results || []).map((result, idx) => ({
    token: cleaned[idx],
    ok: !result.error,
    error: result.error || null
  }));
  const successCount = results.filter((r) => r.ok).length;
  const failureCount = results.length - successCount;
  return { successCount, failureCount, disabled: false, results };
}

