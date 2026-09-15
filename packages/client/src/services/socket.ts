import { io, Socket } from 'socket.io-client';

export function createSocketConnection(): Socket {
  return io({
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });
}
