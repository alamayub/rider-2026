import {
  createConversationRecord,
  createMessageRecord,
  findConversationById,
  findDirectConversation,
  findUserById,
  listConversationsForUser,
  listMessagesByConversation
} from '../../db/store.js';

function canStartConversation(initiatorRole, targetRole) {
  const allowedPairs = new Set(['rider:driver', 'driver:rider', 'rider:admin', 'admin:rider']);
  return allowedPairs.has(`${initiatorRole}:${targetRole}`);
}

export async function startConversation({ initiatorUserId, initiatorRole, participantUserId, rideId }) {
  if (initiatorUserId === participantUserId) {
    throw new Error('Cannot create conversation with yourself');
  }

  const participant = await findUserById(participantUserId);
  if (!participant) {
    throw new Error('Participant not found');
  }

  if (!canStartConversation(initiatorRole, participant.role)) {
    throw new Error('Conversation type not allowed');
  }

  const existing = await findDirectConversation({
    participantAId: initiatorUserId,
    participantBId: participantUserId,
    rideId: rideId || null
  });
  if (existing) return existing;

  return createConversationRecord({
    participantAId: initiatorUserId,
    participantBId: participantUserId,
    rideId: rideId || null,
    actorUserId: initiatorUserId
  });
}

export async function listMyConversations(userId) {
  return listConversationsForUser(userId);
}

export async function listConversationMessages({ conversationId, userId }) {
  const conversation = await findConversationById(conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const isParticipant = conversation.participantAId === userId || conversation.participantBId === userId;
  if (!isParticipant) {
    throw new Error('Forbidden conversation access');
  }

  return listMessagesByConversation(conversationId);
}

export async function sendMessage({ conversationId, senderUserId, content }) {
  const conversation = await findConversationById(conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const isParticipant = conversation.participantAId === senderUserId || conversation.participantBId === senderUserId;
  if (!isParticipant) {
    throw new Error('Forbidden conversation access');
  }
  if (!content || !content.trim()) {
    throw new Error('Message content is required');
  }

  return createMessageRecord({
    conversationId,
    senderUserId,
    content: content.trim(),
    actorUserId: senderUserId
  });
}
