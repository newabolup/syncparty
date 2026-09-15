import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { prisma } from '../db/prisma.js';
import {
  type PlaybackState,
  type RoomMember,
  type RoomMetadata,
  type RoomRole,
  type ChatMessage,
  type VideoProviderType,
  type PlaybackActionPayload,
  detectVideoProvider,
  calculateExpectedPosition,
  SYNC_CONSTANTS,
  CreateRoomInput,
} from '@syncparty/shared';

// Avatar colors assigned randomly to participants
const AVATAR_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
];

interface ActiveRoom {
  id: string;
  slug: string;
  name: string;
  passwordHash: string | null;
  hostToken: string;
  isHostOnlyControls: boolean;
  createdAt: number;
  playbackState: PlaybackState;
  members: Map<string, RoomMember & { socketId: string }>;
  recentMessages: ChatMessage[];
}

export class RoomManager {
  private rooms = new Map<string, ActiveRoom>();
  private slugToId = new Map<string, string>();

  /**
   * Initializes or fetches a room by ID or slug.
   */
  public async getOrCreateRoom(idOrSlug: string): Promise<ActiveRoom | null> {
    const roomId = this.slugToId.get(idOrSlug) || idOrSlug;
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    // Try finding in database
    const dbRoom = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomId }, { slug: idOrSlug }],
      },
      include: {
        chatMessages: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!dbRoom) {
      return null;
    }

    const provider = (dbRoom.videoProvider as VideoProviderType) || 'direct';
    const activeRoom: ActiveRoom = {
      id: dbRoom.id,
      slug: dbRoom.slug,
      name: dbRoom.name,
      passwordHash: dbRoom.passwordHash,
      hostToken: dbRoom.hostToken,
      isHostOnlyControls: dbRoom.isHostOnlyControls,
      createdAt: dbRoom.createdAt.getTime(),
      playbackState: {
        url: dbRoom.videoUrl,
        provider,
        isPlaying: dbRoom.isPlaying,
        position: dbRoom.playbackPosition,
        playbackRate: dbRoom.playbackRate,
        serverTimestamp: Number(dbRoom.serverTimestamp),
        updatedBy: 'system',
        updatedByName: 'System',
        sequenceNumber: dbRoom.sequenceNumber,
      },
      members: new Map(),
      recentMessages: dbRoom.chatMessages
        .reverse()
        .map((m) => ({
          id: m.id,
          roomId: m.roomId,
          senderId: m.senderId,
          senderName: m.senderName,
          senderRole: m.senderRole as RoomRole,
          senderColor: m.senderColor,
          content: m.content,
          timestamp: m.createdAt.getTime(),
          type: m.type as 'message' | 'system',
        })),
    };

    this.rooms.set(activeRoom.id, activeRoom);
    this.slugToId.set(activeRoom.slug, activeRoom.id);
    return activeRoom;
  }

  /**
   * Creates a new watch room.
   */
  public async createRoom(input: CreateRoomInput): Promise<{
    room: RoomMetadata;
    hostToken: string;
    slug: string;
  }> {
    const slug = nanoid(10);
    const hostToken = nanoid(32);
    const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : null;

    const initialVideoUrl = input.videoUrl || '';
    const initialProvider = initialVideoUrl ? detectVideoProvider(initialVideoUrl) : 'direct';
    const now = Date.now();

    const dbRoom = await prisma.room.create({
      data: {
        slug,
        name: input.name,
        passwordHash,
        hostToken,
        isHostOnlyControls: input.isHostOnlyControls ?? true,
        videoUrl: initialVideoUrl,
        videoProvider: initialProvider,
        isPlaying: false,
        playbackPosition: 0.0,
        playbackRate: SYNC_CONSTANTS.DEFAULT_PLAYBACK_RATE,
        serverTimestamp: BigInt(now),
        sequenceNumber: 1,
      },
    });

    const activeRoom: ActiveRoom = {
      id: dbRoom.id,
      slug: dbRoom.slug,
      name: dbRoom.name,
      passwordHash: dbRoom.passwordHash,
      hostToken: dbRoom.hostToken,
      isHostOnlyControls: dbRoom.isHostOnlyControls,
      createdAt: dbRoom.createdAt.getTime(),
      playbackState: {
        url: initialVideoUrl,
        provider: initialProvider,
        isPlaying: false,
        position: 0.0,
        playbackRate: SYNC_CONSTANTS.DEFAULT_PLAYBACK_RATE,
        serverTimestamp: now,
        updatedBy: 'host',
        updatedByName: input.hostUsername,
        sequenceNumber: 1,
      },
      members: new Map(),
      recentMessages: [],
    };

    this.rooms.set(activeRoom.id, activeRoom);
    this.slugToId.set(activeRoom.slug, activeRoom.id);

    return {
      room: {
        id: activeRoom.id,
        name: activeRoom.name,
        hasPassword: !!activeRoom.passwordHash,
        isHostOnlyControls: activeRoom.isHostOnlyControls,
        createdAt: activeRoom.createdAt,
        memberCount: 0,
      },
      hostToken,
      slug: activeRoom.slug,
    };
  }

  /**
   * Verifies password for a room.
   */
  public async verifyPassword(room: ActiveRoom, password?: string): Promise<boolean> {
    if (!room.passwordHash) return true;
    if (!password) return false;
    return bcrypt.compare(password, room.passwordHash);
  }

  /**
   * Adds or updates a participant joining a room.
   */
  public async joinParticipant(
    room: ActiveRoom,
    socketId: string,
    username: string,
    hostToken?: string
  ): Promise<{ member: RoomMember; isHost: boolean }> {
    const isHostByToken = !!hostToken && hostToken === room.hostToken;
    const hasExistingHost = Array.from(room.members.values()).some((m) => m.role === 'host');
    const isHost = isHostByToken || !hasExistingHost;

    const role: RoomRole = isHost ? 'host' : 'participant';
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const member: RoomMember & { socketId: string } = {
      userId: socketId,
      socketId,
      username,
      role,
      joinedAt: Date.now(),
      isBuffering: false,
      avatarColor,
    };

    room.members.set(socketId, member);

    return {
      member: {
        userId: member.userId,
        username: member.username,
        role: member.role,
        joinedAt: member.joinedAt,
        isBuffering: member.isBuffering,
        avatarColor: member.avatarColor,
      },
      isHost,
    };
  }

  /**
   * Removes a member on disconnect.
   */
  public removeParticipant(
    room: ActiveRoom,
    socketId: string
  ): {
    removedMember: RoomMember | null;
    newHost: RoomMember | null;
  } {
    const member = room.members.get(socketId);
    if (!member) return { removedMember: null, newHost: null };

    room.members.delete(socketId);
    let newHost: RoomMember | null = null;

    // If leaving member was host, promote the earliest joined remaining participant
    if (member.role === 'host' && room.members.size > 0) {
      const remaining = Array.from(room.members.values()).sort((a, b) => a.joinedAt - b.joinedAt);
      const nextHost = remaining[0];
      nextHost.role = 'host';
      newHost = {
        userId: nextHost.userId,
        username: nextHost.username,
        role: nextHost.role,
        joinedAt: nextHost.joinedAt,
        isBuffering: nextHost.isBuffering,
        avatarColor: nextHost.avatarColor,
      };
    }

    return {
      removedMember: {
        userId: member.userId,
        username: member.username,
        role: member.role,
        joinedAt: member.joinedAt,
        isBuffering: member.isBuffering,
        avatarColor: member.avatarColor,
      },
      newHost,
    };
  }

  /**
   * Handles user playback action (play, pause, seek, rate, change_video).
   */
  public async handlePlaybackAction(
    room: ActiveRoom,
    socketId: string,
    action: PlaybackActionPayload
  ): Promise<{ state: PlaybackState; error?: string }> {
    const member = room.members.get(socketId);
    if (!member) {
      return { state: room.playbackState, error: 'User is not in room' };
    }

    // Check host-only permission
    if (room.isHostOnlyControls && member.role !== 'host') {
      return {
        state: room.playbackState,
        error: 'Only the host can control playback in this room',
      };
    }

    const now = Date.now();
    const currentState = room.playbackState;

    // Calculate current position up to right now before mutating
    const currentPos = calculateExpectedPosition(currentState, now);

    let nextPosition = currentPos;
    let nextIsPlaying = currentState.isPlaying;
    let nextPlaybackRate = currentState.playbackRate;
    let nextUrl = currentState.url;
    let nextProvider = currentState.provider;

    switch (action.action) {
      case 'play':
        nextIsPlaying = true;
        if (typeof action.position === 'number') {
          nextPosition = Math.max(0, action.position);
        }
        break;

      case 'pause':
        nextIsPlaying = false;
        if (typeof action.position === 'number') {
          nextPosition = Math.max(0, action.position);
        }
        break;

      case 'seek':
        if (typeof action.position === 'number') {
          nextPosition = Math.max(0, action.position);
        }
        break;

      case 'rate':
        if (typeof action.playbackRate === 'number' && action.playbackRate > 0) {
          nextPlaybackRate = action.playbackRate;
          if (typeof action.position === 'number') {
            nextPosition = Math.max(0, action.position);
          }
        }
        break;

      case 'change_video':
        if (action.url) {
          nextUrl = action.url.trim();
          nextProvider = action.provider || detectVideoProvider(nextUrl);
          nextPosition = 0.0;
          nextIsPlaying = false;
        }
        break;

      default:
        return { state: room.playbackState, error: 'Unknown playback action' };
    }

    const updatedState: PlaybackState = {
      url: nextUrl,
      provider: nextProvider,
      isPlaying: nextIsPlaying,
      position: nextPosition,
      playbackRate: nextPlaybackRate,
      serverTimestamp: now,
      updatedBy: member.userId,
      updatedByName: member.username,
      sequenceNumber: currentState.sequenceNumber + 1,
    };

    room.playbackState = updatedState;

    // Asynchronously persist updated state to database
    prisma.room
      .update({
        where: { id: room.id },
        data: {
          videoUrl: updatedState.url,
          videoProvider: updatedState.provider,
          isPlaying: updatedState.isPlaying,
          playbackPosition: updatedState.position,
          playbackRate: updatedState.playbackRate,
          serverTimestamp: BigInt(updatedState.serverTimestamp),
          sequenceNumber: updatedState.sequenceNumber,
        },
      })
      .catch((err) => {
        console.error(`Failed to persist room state for ${room.id}:`, err);
      });

    return { state: updatedState };
  }

  /**
   * Adds a chat message.
   */
  public async addChatMessage(
    room: ActiveRoom,
    sender: RoomMember,
    content: string,
    type: 'message' | 'system' = 'message'
  ): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: nanoid(12),
      roomId: room.id,
      senderId: sender.userId,
      senderName: sender.username,
      senderRole: sender.role,
      senderColor: sender.avatarColor,
      content,
      timestamp: Date.now(),
      type,
    };

    room.recentMessages.push(message);
    if (room.recentMessages.length > 100) {
      room.recentMessages.shift();
    }

    // Persist to DB asynchronously
    prisma.chatMessage
      .create({
        data: {
          id: message.id,
          roomId: room.id,
          senderId: message.senderId,
          senderName: message.senderName,
          senderRole: message.senderRole,
          senderColor: message.senderColor,
          content: message.content,
          type: message.type,
          createdAt: new Date(message.timestamp),
        },
      })
      .catch((err) => {
        console.error('Failed to save chat message:', err);
      });

    return message;
  }

  /**
   * Updates room settings (host only).
   */
  public async updateSettings(
    room: ActiveRoom,
    socketId: string,
    settings: {
      isHostOnlyControls?: boolean;
      password?: string | null;
      videoUrl?: string;
    }
  ): Promise<{ error?: string }> {
    const member = room.members.get(socketId);
    if (!member || member.role !== 'host') {
      return { error: 'Only the host can change room settings' };
    }

    if (typeof settings.isHostOnlyControls === 'boolean') {
      room.isHostOnlyControls = settings.isHostOnlyControls;
    }

    if (settings.password !== undefined) {
      room.passwordHash = settings.password
        ? await bcrypt.hash(settings.password, 10)
        : null;
    }

    if (settings.videoUrl) {
      const provider = detectVideoProvider(settings.videoUrl);
      room.playbackState = {
        ...room.playbackState,
        url: settings.videoUrl,
        provider,
        position: 0,
        isPlaying: false,
        serverTimestamp: Date.now(),
        sequenceNumber: room.playbackState.sequenceNumber + 1,
        updatedBy: member.userId,
        updatedByName: member.username,
      };
    }

    await prisma.room.update({
      where: { id: room.id },
      data: {
        isHostOnlyControls: room.isHostOnlyControls,
        passwordHash: room.passwordHash,
        videoUrl: room.playbackState.url,
        videoProvider: room.playbackState.provider,
        isPlaying: room.playbackState.isPlaying,
        playbackPosition: room.playbackState.position,
        serverTimestamp: BigInt(room.playbackState.serverTimestamp),
        sequenceNumber: room.playbackState.sequenceNumber,
      },
    });

    return {};
  }

  /**
   * Returns list of room members.
   */
  public getMembers(room: ActiveRoom): RoomMember[] {
    return Array.from(room.members.values()).map((m) => ({
      userId: m.userId,
      username: m.username,
      role: m.role,
      joinedAt: m.joinedAt,
      isBuffering: m.isBuffering,
      avatarColor: m.avatarColor,
      latencyMs: m.latencyMs,
    }));
  }

  /**
   * Total active room count.
   */
  public getActiveRoomCount(): number {
    return this.rooms.size;
  }
}

export const roomManager = new RoomManager();
