import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  Lock,
  Radio,
  Settings,
  Sliders,
} from 'lucide-react';
import { SYNC_CONSTANTS, VideoQuality } from '@syncparty/shared';

interface CustomControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  canControl: boolean;
  isFullscreen: boolean;
  syncStatus: 'in_sync' | 'adjusting' | 'seeking';
  driftMs: number;
  qualities: VideoQuality[];
  currentQualityId: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onRateChange: (rate: number) => void;
  onQualityChange: (qualityId: number) => void;
  onToggleFullscreen: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

export const CustomControls: React.FC<CustomControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackRate,
  canControl,
  isFullscreen,
  syncStatus,
  driftMs,
  qualities,
  currentQualityId,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onRateChange,
  onQualityChange,
  onToggleFullscreen,
}) => {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const displayTime = isScrubbing ? scrubTime : currentTime;
  const progressPercent = duration > 0 ? Math.min(100, (displayTime / duration) * 100) : 0;

  const handleSeekStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canControl || !progressRef.current || duration <= 0) return;
    setIsScrubbing(true);
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setScrubTime(ratio * duration);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isScrubbing || !progressRef.current || duration <= 0) return;
      const rect = progressRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setScrubTime(ratio * duration);
    };

    const handleMouseUp = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
        onSeek(scrubTime);
      }
    };

    if (isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, scrubTime, duration, onSeek]);

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-4 flex flex-col gap-2 transition-opacity duration-200">
      {/* Timeline scrubber */}
      <div
        ref={progressRef}
        onClick={handleSeekStart}
        className={`group relative h-2 bg-slate-700/60 rounded-full cursor-pointer transition-all hover:h-3 ${
          !canControl ? 'opacity-70 cursor-not-allowed' : ''
        }`}
      >
        {/* Buffered / background track */}
        <div
          className="absolute left-0 top-0 bottom-0 bg-brand-500 rounded-full transition-all"
          style={{ width: `${progressPercent}%` }}
        />
        {/* Scrub thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-3 text-white text-sm">
        {/* Left: Play/Pause, Volume, Time */}
        <div className="flex items-center gap-3">
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={!canControl}
            title={!canControl ? 'Controls locked by host' : isPlaying ? 'Pause' : 'Play'}
            className={`p-2 rounded-lg hover:bg-white/10 transition duration-150 ${
              !canControl ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-2 group relative">
            <button
              onClick={onToggleMute}
              className="p-2 rounded-lg hover:bg-white/10 transition duration-150"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-16 h-1 accent-brand-500 bg-slate-600 rounded-lg cursor-pointer"
            />
          </div>

          {/* Time display */}
          <div className="text-xs font-mono text-slate-300">
            {formatTime(displayTime)} <span className="text-slate-500">/</span> {formatTime(duration)}
          </div>
        </div>

        {/* Right: Sync Status badge, Quality, Playback speed, Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Host lock notice if applicable */}
          {!canControl && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-md border border-amber-500/30">
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Host Controls Only</span>
            </div>
          )}

          {/* Sync indicator */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/80 rounded-md text-xs font-mono text-slate-300 border border-slate-700/50"
            title={`Drift: ${driftMs > 0 ? '+' : ''}${driftMs}ms`}
          >
            <Radio
              className={`w-3.5 h-3.5 ${
                syncStatus === 'in_sync'
                  ? 'text-emerald-400 animate-pulse'
                  : syncStatus === 'adjusting'
                  ? 'text-amber-400 animate-spin'
                  : 'text-rose-400 animate-bounce'
              }`}
            />
            <span className="hidden md:inline">
              {syncStatus === 'in_sync' ? 'Synced' : syncStatus === 'adjusting' ? 'Adjusting' : 'Seeking'}
            </span>
          </div>

          {/* HLS Quality Selector Dropdown */}
          {qualities.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowQualityMenu(!showQualityMenu)}
                className="p-2 rounded-lg hover:bg-white/10 transition text-xs font-semibold text-slate-300 flex items-center gap-1"
                title="Quality"
              >
                <Sliders className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {currentQualityId === -1
                    ? 'Auto'
                    : qualities.find((q) => q.id === currentQualityId)?.label || 'Auto'}
                </span>
              </button>

              {showQualityMenu && (
                <div className="absolute right-0 bottom-full mb-2 w-32 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden py-1 z-30">
                  <button
                    onClick={() => {
                      onQualityChange(-1);
                      setShowQualityMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 ${
                      currentQualityId === -1 ? 'text-brand-400 font-bold' : 'text-slate-200'
                    }`}
                  >
                    Auto
                  </button>
                  {qualities.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => {
                        onQualityChange(q.id);
                        setShowQualityMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 ${
                        currentQualityId === q.id ? 'text-brand-400 font-bold' : 'text-slate-200'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Speed Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              disabled={!canControl}
              className={`p-2 rounded-lg hover:bg-white/10 transition text-xs font-bold text-slate-300 flex items-center gap-1 ${
                !canControl ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Speed"
            >
              <Settings className="w-4 h-4" />
              <span>{playbackRate}x</span>
            </button>

            {showSettings && canControl && (
              <div className="absolute right-0 bottom-full mb-2 w-28 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden py-1 z-30">
                <div className="px-3 py-1 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Playback Speed
                </div>
                {SYNC_CONSTANTS.ALLOWED_PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      onRateChange(rate);
                      setShowSettings(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 ${
                      playbackRate === rate ? 'text-brand-400 font-bold' : 'text-slate-200'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={onToggleFullscreen}
            className="p-2 rounded-lg hover:bg-white/10 transition duration-150"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
