/**
 * Synchronization tolerance constants (in seconds).
 */
export const SYNC_CONSTANTS = {
  /**
   * If local drift is within 250ms, consider the client in perfect sync.
   * No adjustment needed.
   */
  DRIFT_TOLERANCE_SECONDS: 0.25,

  /**
   * If drift is between 250ms and 2.0s, apply a smooth micro-rate adjustment
   * to catch up or slow down smoothly without jarring video/audio glitches.
   */
  HARD_SEEK_THRESHOLD_SECONDS: 2.0,

  /**
   * Micro-rate multiplier when client is slightly behind the server.
   */
  SMOOTH_RATE_SPEED_UP: 1.05,

  /**
   * Micro-rate multiplier when client is slightly ahead of the server.
   */
  SMOOTH_RATE_SLOW_DOWN: 0.95,

  /**
   * Interval (in milliseconds) at which the client exchanges NTP pings with the server
   * to maintain an accurate clock offset.
   */
  NTP_PING_INTERVAL_MS: 4000,

  /**
   * Number of samples kept in the sliding window to compute median clock offset.
   */
  NTP_SAMPLE_WINDOW_SIZE: 7,

  /**
   * Frequency (in milliseconds) of periodic server playback heartbeat broadcasts.
   */
  SERVER_HEARTBEAT_INTERVAL_MS: 5000,

  /**
   * Default playback rate.
   */
  DEFAULT_PLAYBACK_RATE: 1.0,

  /**
   * Available playback rates supported by the UI.
   */
  ALLOWED_PLAYBACK_RATES: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const,

  /**
   * Maximum length of a chat message.
   */
  MAX_CHAT_MESSAGE_LENGTH: 500,

  /**
   * Rate limit: max chat messages per user within 5 seconds.
   */
  CHAT_RATE_LIMIT_COUNT: 5,
  CHAT_RATE_LIMIT_WINDOW_MS: 5000,

  /**
   * Maximum length of room name.
   */
  MAX_ROOM_NAME_LENGTH: 50,

  /**
   * Default sample test video URLs for quick party launch.
   */
  DEFAULT_SAMPLE_VIDEOS: [
    {
      label: 'Big Buck Bunny (MP4 Direct)',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      provider: 'direct',
    },
    {
      label: 'Elephants Dream (MP4 Direct)',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      provider: 'direct',
    },
    {
      label: 'Tears of Steel (HLS Adaptive)',
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      provider: 'hls',
    },
    {
      label: 'Sintel (HLS Multi-Quality)',
      url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
      provider: 'hls',
    },
  ] as const,
} as const;
