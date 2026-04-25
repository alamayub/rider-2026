import { Server } from 'socket.io';
import { upsertDriverLocation } from '../../db/store.js';
import { logger } from '../../utils/logger.js';

export function createSocketServer(httpServer, corsOrigin) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin }
  });

  io.on('connection', (socket) => {
    logger.info('socket_connected', { socketId: socket.id });

    socket.on('driver:location', async (payload) => {
      const record = await upsertDriverLocation(payload);
      io.emit('driver:location:updated', record);
    });

    socket.on('ride:join', ({ rideId }) => socket.join(`ride:${rideId}`));
  });

  return io;
}
