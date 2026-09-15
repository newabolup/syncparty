import { describe, it, expect } from 'vitest';
import {
  calculateClockOffset,
  calculateMedianOffset,
  calculateExpectedPosition,
  calculateDrift,
  getDriftCorrectionAction,
  detectVideoProvider,
  extractYouTubeId,
  extractVimeoId,
  PlaybackState,
} from '../src/index.js';

describe('Synchronization Math & Clocks', () => {
  it('correctly computes NTP clock offset and RTT', () => {
    // Client sends at 1000, Server receives at 1050, Transmits at 1052, Client receives at 1102
    // RTT = (1102 - 1000) - (1052 - 1050) = 102 - 2 = 100ms
    // Latency = 50ms
    // Server time at client send was 1000, server clock was synchronized with client:
    // Offset = ((1050 - 1000) + (1052 - 1102)) / 2 = (50 - 50) / 2 = 0ms
    const result = calculateClockOffset(1000, 1050, 1052, 1102);
    expect(result.roundTripTime).toBe(100);
    expect(result.oneWayLatency).toBe(50);
    expect(result.clockOffset).toBe(0);
  });

  it('correctly handles client clock ahead or behind server', () => {
    // Server is 500ms ahead of client
    // t0 = 1000
    // t1 = 1550 (1000 + 50ms transit + 500ms server ahead)
    // t2 = 1552
    // t3 = 1102 (1000 + 100ms RTT + 2ms server processing)
    const result = calculateClockOffset(1000, 1550, 1552, 1102);
    expect(result.roundTripTime).toBe(100);
    expect(result.clockOffset).toBe(500);
  });

  it('calculates median offset ignoring outliers', () => {
    const samples = [10, 12, 11, 200, 9, 10, 13];
    expect(calculateMedianOffset(samples)).toBe(11);

    const evenSamples = [10, 20, 30, 40];
    expect(calculateMedianOffset(evenSamples)).toBe(25);
  });

  it('freezes expected position when paused', () => {
    const state: PlaybackState = {
      url: 'https://example.com/video.mp4',
      provider: 'direct',
      isPlaying: false,
      position: 42.5,
      playbackRate: 1.0,
      serverTimestamp: 1000000,
      updatedBy: 'u1',
      updatedByName: 'Alice',
      sequenceNumber: 1,
    };

    // 10 seconds later in real time
    const expected = calculateExpectedPosition(state, 1010000);
    expect(expected).toBe(42.5);
  });

  it('accurately projects position when playing at 1.0x', () => {
    const state: PlaybackState = {
      url: 'https://example.com/video.mp4',
      provider: 'direct',
      isPlaying: true,
      position: 10.0,
      playbackRate: 1.0,
      serverTimestamp: 1000000,
      updatedBy: 'u1',
      updatedByName: 'Alice',
      sequenceNumber: 1,
    };

    // 5.5 seconds later
    const expected = calculateExpectedPosition(state, 1005500);
    expect(expected).toBeCloseTo(15.5, 4);
  });

  it('accurately projects position with custom playback rate (1.5x)', () => {
    const state: PlaybackState = {
      url: 'https://example.com/video.mp4',
      provider: 'direct',
      isPlaying: true,
      position: 20.0,
      playbackRate: 1.5,
      serverTimestamp: 1000000,
      updatedBy: 'u1',
      updatedByName: 'Alice',
      sequenceNumber: 1,
    };

    // 10 seconds of real-time = 15 seconds of video
    const expected = calculateExpectedPosition(state, 1010000);
    expect(expected).toBeCloseTo(35.0, 4);
  });

  it('clamps expected position to duration if provided', () => {
    const state: PlaybackState = {
      url: 'https://example.com/video.mp4',
      provider: 'direct',
      isPlaying: true,
      position: 50.0,
      playbackRate: 1.0,
      serverTimestamp: 1000000,
      updatedBy: 'u1',
      updatedByName: 'Alice',
      sequenceNumber: 1,
    };

    const expected = calculateExpectedPosition(state, 1020000, 60.0);
    expect(expected).toBe(60.0);
  });

  it('classifies drift actions correctly according to dual-threshold model', () => {
    // 1. Within tolerance (0.15s) -> in_sync
    const actionInSync = getDriftCorrectionAction(0.15, 30.0, 1.0);
    expect(actionInSync.type).toBe('in_sync');

    // 2. Client is slightly behind (-0.6s) -> smooth speed up (1.05x)
    const actionSlow = getDriftCorrectionAction(-0.6, 30.0, 1.0);
    expect(actionSlow.type).toBe('smooth_adjust');
    if (actionSlow.type === 'smooth_adjust') {
      expect(actionSlow.targetRate).toBeCloseTo(1.05, 3);
      expect(actionSlow.reason).toBe('catching_up');
    }

    // 3. Client is slightly ahead (+0.8s) -> smooth slow down (0.95x)
    const actionFast = getDriftCorrectionAction(0.8, 30.0, 1.0);
    expect(actionFast.type).toBe('smooth_adjust');
    if (actionFast.type === 'smooth_adjust') {
      expect(actionFast.targetRate).toBeCloseTo(0.95, 3);
      expect(actionFast.reason).toBe('slowing_down');
    }

    // 4. Large drift (-4.5s) -> hard seek
    const actionHard = getDriftCorrectionAction(-4.5, 30.0, 1.0);
    expect(actionHard.type).toBe('hard_seek');
    if (actionHard.type === 'hard_seek') {
      expect(actionHard.targetPosition).toBe(30.0);
    }
  });

  it('detects video providers correctly', () => {
    expect(detectVideoProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube');
    expect(detectVideoProvider('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
    expect(detectVideoProvider('https://vimeo.com/76979871')).toBe('vimeo');
    expect(detectVideoProvider('https://example.com/live/master.m3u8')).toBe('hls');
    expect(detectVideoProvider('https://example.com/video.mp4')).toBe('direct');
  });

  it('extracts YouTube and Vimeo IDs correctly', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ');
    expect(extractVimeoId('https://vimeo.com/76979871')).toBe('76979871');
  });
});
