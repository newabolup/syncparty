import { z } from 'zod';
import { SYNC_CONSTANTS } from './constants.js';
import type { VideoProviderType } from './types.js';

/**
 * Detects the video provider type from a given URL.
 */
export function detectVideoProvider(url: string): VideoProviderType {
  const trimmed = url.trim();

  // YouTube
  if (
    /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(trimmed)
  ) {
    return 'youtube';
  }

  // Vimeo
  if (/^(https?:\/\/)?(www\.)?vimeo\.com\/.+$/i.test(trimmed)) {
    return 'vimeo';
  }

  // HLS stream (.m3u8)
  if (/\.m3u8(\?.*)?$/i.test(trimmed)) {
    return 'hls';
  }

  // Default to direct HTML5 video (mp4, webm, ogg, or direct stream)
  return 'direct';
}

/**
 * Extracts YouTube Video ID if present.
 */
export function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Extracts Vimeo Video ID if present.
 */
export function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/);
  return match ? match[3] : null;
}

/**
 * Zod validation schema for creating a new room.
 */
export const CreateRoomSchema = z.object({
  name: z
    .string()
    .min(1, 'Room name is required')
    .max(SYNC_CONSTANTS.MAX_ROOM_NAME_LENGTH, 'Room name too long')
    .trim(),
  hostUsername: z
    .string()
    .min(1, 'Username is required')
    .max(30, 'Username too long')
    .trim(),
  password: z
    .string()
    .max(64, 'Password too long')
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  isHostOnlyControls: z.boolean().default(true),
  videoUrl: z
    .string()
    .url('Please enter a valid URL')
    .optional()
    .or(z.literal(''))
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
});

export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;

/**
 * Zod validation schema for joining a room.
 */
export const JoinRoomSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required').trim(),
  username: z.string().min(1, 'Username is required').max(30, 'Username too long').trim(),
  password: z.string().max(64).optional(),
  hostToken: z.string().optional(),
});

export type JoinRoomInput = z.infer<typeof JoinRoomSchema>;

/**
 * Zod validation schema for verifying room password.
 */
export const VerifyPasswordSchema = z.object({
  password: z.string().min(1, 'Password required'),
});

/**
 * Zod validation schema for updating room settings.
 */
export const UpdateRoomSettingsSchema = z.object({
  isHostOnlyControls: z.boolean().optional(),
  password: z.string().max(64).nullable().optional(),
  videoUrl: z.string().url('Invalid video URL').optional(),
});

/**
 * Zod validation schema for chat message sending.
 */
export const SendChatMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(SYNC_CONSTANTS.MAX_CHAT_MESSAGE_LENGTH, 'Message is too long')
    .trim(),
});

/**
 * Zod validation schema for playback action.
 */
export const PlaybackActionSchema = z.object({
  action: z.enum(['play', 'pause', 'seek', 'rate', 'change_video']),
  position: z.number().min(0).optional(),
  playbackRate: z.number().positive().optional(),
  url: z.string().url().optional(),
  provider: z.enum(['direct', 'hls', 'youtube', 'vimeo']).optional(),
});
