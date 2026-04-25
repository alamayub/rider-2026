import {
  ensureRiderSupportConversation,
  listConversationMessages,
  listMyConversations,
  sendMessage,
  startConversation
} from '../services/messages.service.js';

export async function ensureRiderSupportConversationController(req, res) {
  try {
    if (req.user.role !== 'rider') {
      return res.status(403).json({ error: 'Support endpoint is for riders only' });
    }
    const conversation = await ensureRiderSupportConversation({ riderUserId: req.user.sub });
    return res.status(200).json(conversation);
  } catch (error) {
    const msg = error?.message || 'Unable to open support';
    const status = msg.includes('only available') || msg.includes('for riders') ? 403 : msg.includes('No support') ? 503 : 400;
    return res.status(status).json({ error: msg });
  }
}

export async function startConversationController(req, res) {
  try {
    const { participantUserId, rideId } = req.body;
    if (!participantUserId) {
      return res.status(400).json({ error: 'participantUserId is required' });
    }

    const conversation = await startConversation({
      initiatorUserId: req.user.sub,
      initiatorRole: req.user.role,
      participantUserId,
      rideId
    });

    return res.status(201).json(conversation);
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : error.message.includes('not allowed') ? 403 : 400;
    return res.status(status).json({ error: error.message });
  }
}

export async function listMyConversationsController(req, res) {
  return res.json(await listMyConversations(req.user.sub));
}

export async function listMessagesController(req, res) {
  try {
    return res.json(await listConversationMessages({ conversationId: req.params.conversationId, userId: req.user.sub }));
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 403;
    return res.status(status).json({ error: error.message });
  }
}

export async function sendMessageController(req, res) {
  try {
    const message = await sendMessage({
      conversationId: req.params.conversationId,
      senderUserId: req.user.sub,
      content: req.body.content
    });

    return res.status(201).json(message);
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : error.message.includes('required') ? 400 : 403;
    return res.status(status).json({ error: error.message });
  }
}
