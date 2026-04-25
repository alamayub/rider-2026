/** Holds Socket.IO server instance for HTTP handlers (no import cycles with socket.js). */

let ioInstance = null;

export function setSocketIoServer(io) {
  ioInstance = io;
}

export function emitConversationNewMessage(message) {
  if (!ioInstance || message == null || message.conversationId == null) return;
  ioInstance.to(`conversation:${message.conversationId}`).emit('message:new', message);
}
