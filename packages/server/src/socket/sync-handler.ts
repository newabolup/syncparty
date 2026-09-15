import { Socket, Server } from 'socket.io';
import {
  SOCKET_EVENTS,
  SyncPingPayload,
  SyncPongPayload,
  PlaybackActionSchema,
  BufferStatePayload,
} from '@syncparty/shared';
import { roomManager } from '../services/room-manager.js';

export function registerSyncHandlers(io: Server, socket: Socket): void {
  /**
   * High-precision NTP clock synchronization handler.
   * Client sends clientSendTime (t0), server records serverReceiveTime (t1),
   * transmits serverTransmitTime (t2).
   */
  socket.on(SOCKET_EVENTS.SYNC_PING, (payload: SyncPingPayload) => {
    const serverReceiveTime = Date.now();
    const serverTransmitTime = Date.now();

    const response: SyncPongPayload = {
      clientSendTime: payload.clientSendTime,
      serverReceiveTime,
      serverTransmitTime,
    };

    socket.emit(SOCKET_EVENTS.SYNC_PONG, response);
  });

  /**
   * Client playback action (play, pause, seek, rate, video change).
   */
  socket.on(SOCKET_EVENTS.PLAYBACK_ACTION, async (rawPayload: unknown) => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      return socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: 'Not connected to a room' });
    }

    const room = await roomManager.getOrCreateRoom(roomId);
    if (!room) {
      return socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: 'Room not found' });
    }

    const parseResult = PlaybackActionSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
        message: 'Invalid playback action payload',
        details: parseResult.error.format(),
      });
    }

    const { state, error } = await roomManager.handlePlaybackAction(
      room,
      socket.id,
      parseResult.data
    );

    if (error) {
      return socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: error });
    }

    // Broadcast authoritative state update to every participant in the room
    io.to(room.id).emit(SOCKET_EVENTS.PLAYBACK_STATE_UPDATE, state);
  });

  /**
   * Client buffer state notification.
   */
  socket.on(SOCKET_EVENTS.PLAYBACK_BUFFER_STATE, async (payload: BufferStatePayload) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = await roomManager.getOrCreateRoom(roomId);
    if (!room) return;

    const member = room.members.get(socket.id);
    if (member) {
      member.isBuffering = !!payload.isBuffering;
      // Notify room members of updated member states
      io.to(room.id).emit(SOCKET_EVENTS.ROOM_MEMBERS_UPDATE, roomManager.getMembers(room));
    }
  });
}
