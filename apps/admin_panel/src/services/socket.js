import { io } from 'socket.io-client'

const socketBaseUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
let socket = null

export function connectSocket(token) {
  if (socket) return socket
  socket = io(socketBaseUrl, {
    transports: ['websocket'],
    auth: { token: token ? `Bearer ${token}` : '' },
  })
  return socket
}

export function disconnectSocket() {
  if (!socket) return
  socket.disconnect()
  socket = null
}
