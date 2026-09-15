/**
 * Supported video provider types.
 */
export type VideoProviderType = 'direct' | 'hls' | 'youtube' | 'vimeo';

/**
 * Authoritative playback state managed by the server and synchronized across clients.
 */
export interface PlaybackState {
  /** Video URL currently playing */
  url: string;
  /** Resolved provider type */
  provider: VideoProviderType;
  /** True if currently playing, false if paused */
  isPlaying: boolean;
  /** Playback position in seconds at serverTimestamp */
  position: number;
  /** Current playback rate (e.g. 1.0) */
  playbackRate: number;
  /** Server timestamp (in milliseconds, UTC) when this state was committed */
  serverTimestamp: number;
  /** User ID who triggered this state change */
  updatedBy: string;
  /** User display name who triggered this change */
  updatedByName: string;
  /** Monotonically increasing revision counter to detect out-of-order events */
  sequenceNumber: number;
}

/**
 * Role of a user in a room.
 */
export type RoomRole = 'host' | 'participant';

/**
 * Represents a member currently present in the room.
 */
export interface RoomMember {
  userId: string;
  username: string;
  role: RoomRole;
  joinedAt: number;
  isBuffering: boolean;
  avatarColor: string;
  latencyMs?: number;
}

/**
 * Public room metadata.
 */
export interface RoomMetadata {
  id: string;
  name: string;
  hasPassword: boolean;
  isHostOnlyControls: boolean;
  createdAt: number;
  memberCount: number;
  currentVideoTitle?: string;
}

/**
 * Chat message structure.
 */
export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: RoomRole;
  senderColor: string;
  content: string;
  timestamp: number;
  type: 'message' | 'system';
}

/**
 * NTP clock synchronization payloads.
 */
export interface SyncPingPayload {
  clientSendTime: number;
}

export interface SyncPongPayload {
  clientSendTime: number;
  serverReceiveTime: number;
  serverTransmitTime: number;
}

/**
 * Playback action payloads initiated by client.
 */
export interface PlaybackActionPayload {
  action: 'play' | 'pause' | 'seek' | 'rate' | 'change_video';
  position?: number;
  playbackRate?: number;
  url?: string;
  provider?: VideoProviderType;
}

/**
 * Client buffer state reporting.
 */
export interface BufferStatePayload {
  isBuffering: boolean;
  position: number;
}

/**
 * Socket.IO event name constants and contracts.
 */
export const SOCKET_EVENTS = {
  // Connection / Room lifecycle
  ROOM_JOIN: 'room:join',
  ROOM_JOINED: 'room:joined',
  ROOM_LEAVE: 'room:leave',
  ROOM_MEMBERS_UPDATE: 'room:members_update',
  ROOM_SETTINGS_UPDATE: 'room:settings_update',
  ROOM_SETTINGS_CHANGED: 'room:settings_changed',
  ROOM_ERROR: 'room:error',

  // Playback synchronization
  SYNC_PING: 'sync:ping',
  SYNC_PONG: 'sync:pong',
  PLAYBACK_ACTION: 'playback:action',
  PLAYBACK_STATE_UPDATE: 'playback:state_update',
  PLAYBACK_HEARTBEAT: 'playback:heartbeat',
  PLAYBACK_BUFFER_STATE: 'playback:buffer_state',

  // Chat
  CHAT_SEND: 'chat:send',
  CHAT_RECEIVE: 'chat:receive',
  CHAT_HISTORY: 'chat:history',
} as const;

/**
 * Video quality representation for HLS and adaptive streams.
 */
export interface VideoQuality {
  id: number;
  height: number;
  bitrate?: number;
  label: string;
}
