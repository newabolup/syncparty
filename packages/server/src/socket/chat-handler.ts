import { Socket, Server } from 'socket.io';
import { SOCKET_EVENTS, SendChatMessageSchema, SYNC_CONSTANTS } from '@syncparty/shared';
import { roomManager } from '../services/room-manager.js';

// Simple in-memory socket message timestamps for rate limiting
const messageTimestamps = new Map<string, number[]>();

function isRateLimited(socketId: string): boolean {
  const now = Date.now();
  let timestamps = messageTimestamps.get(socketId) || [];
  timestamps = timestamps.filter((t) => now - t < SYNC_CONSTANTS.CHAT_RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= SYNC_CONSTANTS.CHAT_RATE_LIMIT_COUNT) {
    messageTimestamps.set(socketId, timestamps);
    return true;
  }

  timestamps.push(now);
  messageTimestamps.set(socketId, timestamps);
  return false;
}

export function cleanupChatRateLimit(socketId: string): void {
  messageTimestamps.delete(socketId);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function registerChatHandlers(io: Server, socket: Socket): void {
  socket.on(SOCKET_EVENTS.CHAT_SEND, async (rawPayload: unknown) => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      return socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: 'Not in a room' });
    }

    if (isRateLimited(socket.id)) {
      return socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
        message: 'You are sending messages too quickly. Please slow down.',
      });
    }

    const parseResult = SendChatMessageSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
        message: 'Invalid message',
        details: parseResult.error.format(),
      });
    }

    const room = await roomManager.getOrCreateRoom(roomId);
    if (!room) return;

    const member = room.members.get(socket.id);
    if (!member) return;

    const sanitizedContent = escapeHtml(parseResult.data.content);
    const message = await roomManager.addChatMessage(room, member, sanitizedContent, 'message');

    // Broadcast to room
    io.to(room.id).emit(SOCKET_EVENTS.CHAT_RECEIVE, message);
  });
}
