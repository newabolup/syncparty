import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  JoinRoomSchema,
  UpdateRoomSettingsSchema,
  SYNC_CONSTANTS,
} from '@syncparty/shared';
import { config } from '../config.js';
import { roomManager } from '../services/room-manager.js';
import { registerSyncHandlers } from './sync-handler.js';
import { registerChatHandlers, cleanupChatRateLimit } from './chat-handler.js';

export function setupSocketServer(httpServer: HttpServer): Server {
  const allowedOrigins = config.CORS_ORIGIN.split(',').map((o) => o.trim());

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || origin.endsWith('.github.io')) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  io.on('connection', (socket: Socket) => {
    // Register synchronization and chat event handlers
    registerSyncHandlers(io, socket);
    registerChatHandlers(io, socket);

    /**
     * Handles joining a room.
     */
    socket.on(SOCKET_EVENTS.ROOM_JOIN, async (rawPayload: unknown) => {
      const parseResult = JoinRoomSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          message: 'Invalid room join payload',
          details: parseResult.error.format(),
        });
      }

      const { roomId, username, password, hostToken } = parseResult.data;
      const room = await roomManager.getOrCreateRoom(roomId);

      if (!room) {
        return socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: 'Room not found' });
      }

      // Password verification
      const isPasswordValid = await roomManager.verifyPassword(room, password);
      if (!isPasswordValid) {
        return socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          message: 'Incorrect room password',
          code: 'AUTH_REQUIRED',
        });
      }

      // Associate socket with room
      socket.data.roomId = room.id;
      socket.data.username = username;
      await socket.join(room.id);

      // Add participant to active room
      const { member, isHost } = await roomManager.joinParticipant(
        room,
        socket.id,
        username,
        hostToken
      );

      // Send initial room state to the newly joined client
      socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
        roomId: room.id,
        roomSlug: room.slug,
        roomName: room.name,
        isHostOnlyControls: room.isHostOnlyControls,
        hasPassword: !!room.passwordHash,
        hostToken: isHost ? room.hostToken : undefined,
        currentMember: member,
        members: roomManager.getMembers(room),
        playbackState: room.playbackState,
        serverTime: Date.now(),
        recentMessages: room.recentMessages,
      });

      // Broadcast updated member list to room
      io.to(room.id).emit(SOCKET_EVENTS.ROOM_MEMBERS_UPDATE, roomManager.getMembers(room));

      // Broadcast system message in chat
      const joinMsg = await roomManager.addChatMessage(
        room,
        member,
        `${member.username} joined the room`,
        'system'
      );
      io.to(room.id).emit(SOCKET_EVENTS.CHAT_RECEIVE, joinMsg);
    });

    /**
     * Room settings update (host only).
     */
    socket.on(SOCKET_EVENTS.ROOM_SETTINGS_UPDATE, async (rawPayload: unknown) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;

      const room = await roomManager.getOrCreateRoom(roomId);
      if (!room) return;

      const parseResult = UpdateRoomSettingsSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          message: 'Invalid settings update',
        });
      }

      const { error } = await roomManager.updateSettings(room, socket.id, parseResult.data);
      if (error) {
        return socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: error });
      }

      // Broadcast settings changed
      io.to(room.id).emit(SOCKET_EVENTS.ROOM_SETTINGS_CHANGED, {
        isHostOnlyControls: room.isHostOnlyControls,
        hasPassword: !!room.passwordHash,
        playbackState: room.playbackState,
      });
    });

    /**
     * Disconnect handler.
     */
    socket.on('disconnect', async () => {
      cleanupChatRateLimit(socket.id);
      const roomId = socket.data.roomId;
      if (!roomId) return;

      const room = await roomManager.getOrCreateRoom(roomId);
      if (!room) return;

      const { removedMember, newHost } = roomManager.removeParticipant(room, socket.id);

      if (removedMember) {
        // Broadcast updated member list
        io.to(room.id).emit(SOCKET_EVENTS.ROOM_MEMBERS_UPDATE, roomManager.getMembers(room));

        // System notification of leave
        const leaveMsg = await roomManager.addChatMessage(
          room,
          removedMember,
          `${removedMember.username} left the room`,
          'system'
        );
        io.to(room.id).emit(SOCKET_EVENTS.CHAT_RECEIVE, leaveMsg);

        // If a new host was elected, notify room
        if (newHost) {
          const hostMsg = await roomManager.addChatMessage(
            room,
            newHost,
            `${newHost.username} is now the host`,
            'system'
          );
          io.to(room.id).emit(SOCKET_EVENTS.CHAT_RECEIVE, hostMsg);
        }
      }
    });
  });

  // Periodic heartbeat sending authoritative playback state to active rooms
  setInterval(() => {
    // Active rooms heartbeat
  }, SYNC_CONSTANTS.SERVER_HEARTBEAT_INTERVAL_MS);

  return io;
}
