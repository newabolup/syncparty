import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import {
  PlaybackState,
  SOCKET_EVENTS,
  SyncPongPayload,
  calculateClockOffset,
  calculateMedianOffset,
  calculateExpectedPosition,
  calculateDrift,
  getDriftCorrectionAction,
  SYNC_CONSTANTS,
  VideoProviderType,
} from '@syncparty/shared';

export interface VideoPlayerRef {
  play: () => Promise<void>;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setPlaybackRate: (rate: number) => void;
}

interface UseSyncEngineProps {
  socket: Socket | null;
  playerRef: React.MutableRefObject<VideoPlayerRef | null>;
  isHost: boolean;
  isHostOnlyControls: boolean;
  onToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export function useSyncEngine({
  socket,
  playerRef,
  isHost,
  isHostOnlyControls,
  onToast,
}: UseSyncEngineProps) {
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [clockOffset, setClockOffset] = useState<number>(0);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState<boolean>(false);
  const [driftMs, setDriftMs] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<'in_sync' | 'adjusting' | 'seeking'>('in_sync');

  const offsetSamples = useRef<number[]>([]);
  const isLocalAction = useRef<boolean>(false);


  /**
   * Send NTP Ping to server.
   */
  const sendPing = useCallback(() => {
    if (!socket || !socket.connected) return;
    const clientSendTime = Date.now();
    socket.emit(SOCKET_EVENTS.SYNC_PING, { clientSendTime });
  }, [socket]);

  /**
   * Handle NTP Pong response from server.
   */
  useEffect(() => {
    if (!socket) return;

    const handlePong = (payload: SyncPongPayload) => {
      const clientReceiveTime = Date.now();
      const result = calculateClockOffset(
        payload.clientSendTime,
        payload.serverReceiveTime,
        payload.serverTransmitTime,
        clientReceiveTime
      );

      offsetSamples.current.push(result.clockOffset);
      if (offsetSamples.current.length > SYNC_CONSTANTS.NTP_SAMPLE_WINDOW_SIZE) {
        offsetSamples.current.shift();
      }

      const median = calculateMedianOffset(offsetSamples.current);
      setClockOffset(median);
    };

    socket.on(SOCKET_EVENTS.SYNC_PONG, handlePong);

    // Initial bursts of pings to stabilize offset quickly
    sendPing();
    const t1 = setTimeout(sendPing, 500);
    const t2 = setTimeout(sendPing, 1200);

    // Periodic ping loop
    const pingInterval = setInterval(sendPing, SYNC_CONSTANTS.NTP_PING_INTERVAL_MS);

    return () => {
      socket.off(SOCKET_EVENTS.SYNC_PONG, handlePong);
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(pingInterval);
    };
  }, [socket, sendPing]);

  /**
   * Play video safely, handling browser autoplay policy.
   */
  const attemptPlay = useCallback(async () => {
    if (!playerRef.current) return;
    try {
      await playerRef.current.play();
      setIsAutoplayBlocked(false);
    } catch (err) {
      console.warn('Playback blocked by browser policy:', err);
      setIsAutoplayBlocked(true);
    }
  }, [playerRef]);

  /**
   * Synchronize local player to the authoritative server state.
   */
  const applyAuthoritativeState = useCallback(
    async (state: PlaybackState) => {
      setPlaybackState(state);
      if (!playerRef.current) return;

      const player = playerRef.current;
      const currentServerTime = Date.now() + clockOffset;
      const expectedPos = calculateExpectedPosition(
        state,
        currentServerTime,
        player.getDuration()
      );

      const currentPos = player.getCurrentTime();
      const drift = calculateDrift(currentPos, expectedPos);

      // If playing state differs
      if (state.isPlaying) {
        if (Math.abs(drift) > SYNC_CONSTANTS.HARD_SEEK_THRESHOLD_SECONDS) {
          player.seekTo(expectedPos);
        }
        player.setPlaybackRate(state.playbackRate);
        await attemptPlay();
      } else {
        player.pause();
        if (Math.abs(drift) > SYNC_CONSTANTS.DRIFT_TOLERANCE_SECONDS) {
          player.seekTo(expectedPos);
        }
      }
    },
    [clockOffset, playerRef, attemptPlay]
  );

  /**
   * Listen for authoritative state updates from server.
   */
  useEffect(() => {
    if (!socket) return;

    const handleStateUpdate = (newState: PlaybackState) => {
      applyAuthoritativeState(newState);
    };

    socket.on(SOCKET_EVENTS.PLAYBACK_STATE_UPDATE, handleStateUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.PLAYBACK_STATE_UPDATE, handleStateUpdate);
    };
  }, [socket, applyAuthoritativeState]);

  /**
   * Continuous drift monitoring and correction loop (runs every 500ms).
   */
  useEffect(() => {
    if (!playbackState || !playerRef.current) return;

    const interval = setInterval(() => {
      if (!playerRef.current || !playbackState || isLocalAction.current) return;

      const player = playerRef.current;
      const currentServerTime = Date.now() + clockOffset;
      const expectedPos = calculateExpectedPosition(
        playbackState,
        currentServerTime,
        player.getDuration()
      );

      const currentPos = player.getCurrentTime();
      const drift = calculateDrift(currentPos, expectedPos);
      setDriftMs(Math.round(drift * 1000));

      if (playbackState.isPlaying) {
        const action = getDriftCorrectionAction(
          drift,
          expectedPos,
          playbackState.playbackRate
        );

        if (action.type === 'in_sync') {
          setSyncStatus('in_sync');
          player.setPlaybackRate(playbackState.playbackRate);
        } else if (action.type === 'smooth_adjust') {
          setSyncStatus('adjusting');
          player.setPlaybackRate(action.targetRate);
        } else if (action.type === 'hard_seek') {
          setSyncStatus('seeking');
          player.seekTo(action.targetPosition);
          player.setPlaybackRate(playbackState.playbackRate);
        }
      }
    }, 600);

    return () => clearInterval(interval);
  }, [playbackState, clockOffset, playerRef]);

  /**
   * User interaction actions.
   */
  const canControl = !isHostOnlyControls || isHost;

  const handlePlay = useCallback(() => {
    if (!canControl || !socket || !playerRef.current) {
      if (!canControl && onToast) onToast('Only the host can control playback', 'warning');
      return;
    }
    const pos = playerRef.current.getCurrentTime();
    socket.emit(SOCKET_EVENTS.PLAYBACK_ACTION, { action: 'play', position: pos });
  }, [canControl, socket, playerRef, onToast]);

  const handlePause = useCallback(() => {
    if (!canControl || !socket || !playerRef.current) {
      if (!canControl && onToast) onToast('Only the host can control playback', 'warning');
      return;
    }
    const pos = playerRef.current.getCurrentTime();
    socket.emit(SOCKET_EVENTS.PLAYBACK_ACTION, { action: 'pause', position: pos });
  }, [canControl, socket, playerRef, onToast]);

  const handleSeek = useCallback(
    (seconds: number) => {
      if (!canControl || !socket) {
        if (!canControl && onToast) onToast('Only the host can seek video', 'warning');
        return;
      }
      isLocalAction.current = true;
      if (playerRef.current) {
        playerRef.current.seekTo(seconds);
      }
      socket.emit(SOCKET_EVENTS.PLAYBACK_ACTION, { action: 'seek', position: seconds });
      setTimeout(() => {
        isLocalAction.current = false;
      }, 500);
    },
    [canControl, socket, playerRef, onToast]
  );

  const handleRateChange = useCallback(
    (rate: number) => {
      if (!canControl || !socket || !playerRef.current) {
        if (!canControl && onToast) onToast('Only the host can change speed', 'warning');
        return;
      }
      const pos = playerRef.current.getCurrentTime();
      socket.emit(SOCKET_EVENTS.PLAYBACK_ACTION, {
        action: 'rate',
        playbackRate: rate,
        position: pos,
      });
    },
    [canControl, socket, playerRef, onToast]
  );

  const handleChangeVideo = useCallback(
    (url: string, provider?: VideoProviderType) => {
      if (!canControl || !socket) {
        if (!canControl && onToast) onToast('Only the host can change video', 'warning');
        return;
      }
      socket.emit(SOCKET_EVENTS.PLAYBACK_ACTION, {
        action: 'change_video',
        url,
        provider,
      });
    },
    [canControl, socket, onToast]
  );

  const unlockAutoplay = useCallback(async () => {
    if (playerRef.current) {
      try {
        await playerRef.current.play();
        setIsAutoplayBlocked(false);
      } catch (err) {
        console.error('Failed to unlock autoplay:', err);
      }
    }
  }, [playerRef]);

  return {
    playbackState,
    setPlaybackState,
    clockOffset,
    driftMs,
    syncStatus,
    isAutoplayBlocked,
    unlockAutoplay,
    canControl,
    handlePlay,
    handlePause,
    handleSeek,
    handleRateChange,
    handleChangeVideo,
    applyAuthoritativeState,
  };
}
