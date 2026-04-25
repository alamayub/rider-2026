import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { findConversationById, findUserById, upsertDriverLocation } from '../../db/store.js';
import { sendMessage } from '../messages/messages.service.js';
import { logger } from '../../utils/logger.js';
import { consumeAuthRateLimit } from '../auth/auth.service.js';

export function createSocketServer(httpServer, corsOrigin) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin }
  });

  io.use(async (socket, next) => {
    try {
      const bearer = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      const sourceIp = socket.handshake.address;
      const tokenHint = String(bearer || 'missing-token').slice(0, 24);
      consumeAuthRateLimit({ scope: 'socket-auth', identifier: tokenHint, sourceIp });
      if (!bearer) {
        return next(new Error('Unauthorized'));
      }

      const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : bearer;
      const decoded = jwt.verify(token, env.jwtSecret);
      const user = await findUserById(decoded.sub);

      if (!user || user.status === 'suspended' || user.status === 'banned') {
        return next(new Error('Unauthorized'));
      }

      socket.user = decoded;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    logger.info('socket_connected', { socketId: socket.id, userId: socket.user?.sub });

    socket.on('driver:location', async (payload) => {
      const record = await upsertDriverLocation(payload);
      io.emit('driver:location:updated', record);
    });

    socket.on('ride:join', ({ rideId }) => socket.join(`ride:${rideId}`));

    socket.on('conversation:join', async ({ conversationId }, ack) => {
      const conversation = await findConversationById(conversationId);
      const userId = socket.user?.sub;

      if (!conversation || !userId) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Conversation not found' });
        return;
      }

      const isParticipant = conversation.participantAId === userId || conversation.participantBId === userId;
      if (!isParticipant) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Forbidden conversation access' });
        return;
      }

      socket.join(`conversation:${conversationId}`);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('message:send', async ({ conversationId, content }, ack) => {
      try {
        const message = await sendMessage({
          conversationId,
          senderUserId: socket.user?.sub,
          content
        });

        io.to(`conversation:${conversationId}`).emit('message:new', message);
        if (typeof ack === 'function') ack({ ok: true, message });
      } catch (error) {
        if (typeof ack === 'function') ack({ ok: false, error: error.message });
      }
    });
  });

  return io;
}
