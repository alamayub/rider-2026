import { listConversationMessages, listMyConversations, sendMessage, startConversation } from './messages.service.js';

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
