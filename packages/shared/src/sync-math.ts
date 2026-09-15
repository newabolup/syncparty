import { SYNC_CONSTANTS } from './constants.js';
import type { PlaybackState } from './types.js';

export interface ClockSyncResult {
  roundTripTime: number;
  oneWayLatency: number;
  clockOffset: number; // serverTime = clientTime + clockOffset
}

/**
 * Computes the clock offset using standard NTP 4-timestamp formula:
 * t0 = clientSendTime
 * t1 = serverReceiveTime
 * t2 = serverTransmitTime
 * t3 = clientReceiveTime
 *
 * RTT = (t3 - t0) - (t2 - t1)
 * Latency = RTT / 2
 * Offset = ((t1 - t0) + (t2 - t3)) / 2
 */
export function calculateClockOffset(
  t0: number,
  t1: number,
  t2: number,
  t3: number
): ClockSyncResult {
  const roundTripTime = Math.max(0, t3 - t0 - (t2 - t1));
  const oneWayLatency = roundTripTime / 2;
  const clockOffset = ((t1 - t0) + (t2 - t3)) / 2;

  return {
    roundTripTime,
    oneWayLatency,
    clockOffset,
  };
}

/**
 * Computes median value of an array of numbers to filter out latency spikes and jitter.
 */
export function calculateMedianOffset(offsets: number[]): number {
  if (offsets.length === 0) return 0;
  const sorted = [...offsets].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculates the current expected video position according to the authoritative playback state.
 *
 * @param state Authoritative playback state
 * @param currentServerTime Estimated current server time in ms (Date.now() + clockOffset)
 * @param duration Optional maximum video duration in seconds
 */
export function calculateExpectedPosition(
  state: PlaybackState,
  currentServerTime: number,
  duration?: number
): number {
  // If state is paused, expected position is frozen at state.position
  if (!state.isPlaying) {
    return Math.max(0, state.position);
  }

  // Elapsed real-time on server since the last authoritative state update
  const elapsedRealTimeMs = Math.max(0, currentServerTime - state.serverTimestamp);
  const elapsedVideoTimeSec = (elapsedRealTimeMs / 1000) * (state.playbackRate || 1.0);

  let expected = state.position + elapsedVideoTimeSec;

  if (typeof duration === 'number' && duration > 0) {
    expected = Math.min(expected, duration);
  }

  return Math.max(0, expected);
}

/**
 * Calculates drift between client playback and expected position.
 * Positive drift: client is ahead of server.
 * Negative drift: client is behind server.
 */
export function calculateDrift(clientCurrentTime: number, expectedPosition: number): number {
  return clientCurrentTime - expectedPosition;
}

export type DriftCorrectionAction =
  | { type: 'in_sync' }
  | {
      type: 'smooth_adjust';
      targetRate: number;
      drift: number;
      reason: 'catching_up' | 'slowing_down';
    }
  | {
      type: 'hard_seek';
      targetPosition: number;
      drift: number;
    };

/**
 * Evaluates the required synchronization action based on the dual-threshold drift model.
 *
 * @param drift Difference in seconds (clientCurrentTime - expectedPosition)
 * @param expectedPosition The expected position in seconds
 * @param baseRate The nominal playback rate (e.g. 1.0)
 * @param tolerance Max tolerable drift in seconds (default 0.25s)
 * @param hardSeekThreshold Threshold in seconds beyond which hard seek occurs (default 2.0s)
 */
export function getDriftCorrectionAction(
  drift: number,
  expectedPosition: number,
  baseRate: number = SYNC_CONSTANTS.DEFAULT_PLAYBACK_RATE,
  tolerance: number = SYNC_CONSTANTS.DRIFT_TOLERANCE_SECONDS,
  hardSeekThreshold: number = SYNC_CONSTANTS.HARD_SEEK_THRESHOLD_SECONDS
): DriftCorrectionAction {
  const absDrift = Math.abs(drift);

  // In sync zone: within tolerance (<= 250ms)
  if (absDrift <= tolerance) {
    return { type: 'in_sync' };
  }

  // Large drift (> 2.0s): perform an immediate seek
  if (absDrift > hardSeekThreshold) {
    return {
      type: 'hard_seek',
      targetPosition: expectedPosition,
      drift,
    };
  }

  // Moderate drift (0.25s to 2.0s): smooth micro-rate adjustment
  if (drift < 0) {
    // Client is behind, slightly speed up
    return {
      type: 'smooth_adjust',
      targetRate: baseRate * SYNC_CONSTANTS.SMOOTH_RATE_SPEED_UP,
      drift,
      reason: 'catching_up',
    };
  } else {
    // Client is ahead, slightly slow down
    return {
      type: 'smooth_adjust',
      targetRate: baseRate * SYNC_CONSTANTS.SMOOTH_RATE_SLOW_DOWN,
      drift,
      reason: 'slowing_down',
    };
  }
}
