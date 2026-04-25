import {
  createConversationRecord,
  createMessageRecord,
  findConversationById,
  findDirectConversation,
  findFirstActiveAdminUser,
  findUserById,
  listConversationsForUserWithPeers,
  listMessagesByConversation
} from '../db/store.js';
import { emitConversationNewMessage } from '../realtime/socket-io-hub.js';

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
  return listConversationsForUserWithPeers(userId);
}

/** Rider-only: get or create the direct chat with the primary on-call admin (sorted by user id). */
export async function ensureRiderSupportConversation({ riderUserId }) {
  const rider = await findUserById(riderUserId);
  if (!rider || rider.role !== 'rider') {
    throw new Error('Support chat is only available for rider accounts');
  }
  const admin = await findFirstActiveAdminUser();
  if (!admin) {
    throw new Error('No support agent is available yet. Please try again later.');
  }
  return startConversation({
    initiatorUserId: riderUserId,
    initiatorRole: 'rider',
    participantUserId: admin.id,
    rideId: null
  });
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

  const message = await createMessageRecord({
    conversationId,
    senderUserId,
    content: content.trim(),
    actorUserId: senderUserId
  });
  emitConversationNewMessage(message);
  return message;
}
