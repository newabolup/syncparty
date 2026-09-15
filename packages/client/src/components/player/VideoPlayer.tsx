import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import Hls from 'hls.js';
import {
  VideoProviderType,
  VideoQuality,
  extractYouTubeId,
} from '@syncparty/shared';
import { VideoPlayerRef } from '../../hooks/useSyncEngine.js';
import { CustomControls } from './CustomControls.js';
import { AutoplayOverlay } from './AutoplayOverlay.js';
import { Film, AlertCircle, Loader2 } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  provider: VideoProviderType;
  isPlaying: boolean;
  canControl: boolean;
  syncStatus: 'in_sync' | 'adjusting' | 'seeking';
  driftMs: number;
  isAutoplayBlocked: boolean;
  onUnlockAutoplay: () => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (seconds: number) => void;
  onRateChange: (rate: number) => void;
  onBufferStateChange?: (isBuffering: boolean, position: number) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  (
    {
      url,
      provider,
      isPlaying,
      canControl,
      syncStatus,
      driftMs,
      isAutoplayBlocked,
      onUnlockAutoplay,
      onPlay,
      onPause,
      onSeek,
      onRateChange,
      onBufferStateChange,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const ytPlayerRef = useRef<any>(null);
    const hlsRef = useRef<Hls | null>(null);

    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    const [volume, setVolume] = useState<number>(() => {
      const saved = localStorage.getItem('syncparty_volume');
      return saved !== null ? parseFloat(saved) : 0.8;
    });
    const [isMuted, setIsMuted] = useState<boolean>(() => {
      return localStorage.getItem('syncparty_muted') === 'true';
    });
    const [playbackRate, setPlaybackRateState] = useState<number>(1.0);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [isBuffering, setIsBuffering] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [qualities, setQualities] = useState<VideoQuality[]>([]);
    const [currentQualityId, setCurrentQualityId] = useState<number>(-1);

    // Save volume preferences to localStorage
    const handleVolumeChange = (vol: number) => {
      setVolume(vol);
      setIsMuted(false);
      localStorage.setItem('syncparty_volume', vol.toString());
      localStorage.setItem('syncparty_muted', 'false');
      if (videoRef.current) {
        videoRef.current.volume = vol;
        videoRef.current.muted = false;
      }
      if (ytPlayerRef.current?.setVolume) {
        ytPlayerRef.current.setVolume(vol * 100);
        ytPlayerRef.current.unMute();
      }
    };

    const handleToggleMute = () => {
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      localStorage.setItem('syncparty_muted', nextMuted ? 'true' : 'false');
      if (videoRef.current) {
        videoRef.current.muted = nextMuted;
      }
      if (ytPlayerRef.current) {
        if (nextMuted) ytPlayerRef.current.mute();
        else ytPlayerRef.current.unMute();
      }
    };

    const handleToggleFullscreen = async () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen().catch((err) => console.error(err));
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen().catch((err) => console.error(err));
        setIsFullscreen(false);
      }
    };

    useEffect(() => {
      const onFsChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', onFsChange);
      return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    // Clean and initialize HLS or Direct Video
    useEffect(() => {
      setErrorMsg(null);
      if (!url) return;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (provider === 'hls' && videoRef.current) {
        const video = videoRef.current;

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
          });

          hls.loadSource(url);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
            const levels: VideoQuality[] = data.levels.map((lvl, index) => ({
              id: index,
              height: lvl.height,
              bitrate: lvl.bitrate,
              label: lvl.height ? `${lvl.height}p` : `Level ${index + 1}`,
            }));
            setQualities(levels);
          });

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.error('Fatal network error encountered in HLS, recovering...');
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.error('Fatal media error encountered in HLS, recovering...');
                  hls.recoverMediaError();
                  break;
                default:
                  setErrorMsg('Failed to load HLS stream.');
                  hls.destroy();
                  break;
              }
            }
          });

          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native Safari HLS
          video.src = url;
        } else {
          setErrorMsg('HLS streaming is not supported on this browser.');
        }
      } else if (provider === 'direct' && videoRef.current) {
        videoRef.current.src = url;
        setQualities([]);
      }
    }, [url, provider]);

    // Handle HLS Quality selection
    const handleQualityChange = (qualityId: number) => {
      setCurrentQualityId(qualityId);
      if (hlsRef.current) {
        hlsRef.current.currentLevel = qualityId;
      }
    };

    // YouTube Embed initialization
    const ytId = provider === 'youtube' ? extractYouTubeId(url) : null;

    useEffect(() => {
      if (provider !== 'youtube' || !ytId) return;

      let player: any;

      const initYT = () => {
        if (!(window as any).YT || !(window as any).YT.Player) {
          setTimeout(initYT, 200);
          return;
        }

        player = new (window as any).YT.Player('syncparty-youtube-iframe', {
          videoId: ytId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              ytPlayerRef.current = player;
              setDuration(player.getDuration() || 0);
              if (isMuted) player.mute();
              else player.setVolume(volume * 100);
            },
            onError: () => {
              setErrorMsg('YouTube video is unavailable or restricted from embedding.');
            },
          },
        });
      };

      initYT();

      return () => {
        if (player?.destroy) {
          player.destroy();
        }
        ytPlayerRef.current = null;
      };
    }, [provider, ytId]);

    // Track HTML5 video events (timeupdate, waiting, playing, error)
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const onTimeUpdate = () => {
        setCurrentTime(video.currentTime);
        setDuration(video.duration || 0);
      };

      const onWaiting = () => {
        setIsBuffering(true);
        if (onBufferStateChange) onBufferStateChange(true, video.currentTime);
      };

      const onPlaying = () => {
        setIsBuffering(false);
        if (onBufferStateChange) onBufferStateChange(false, video.currentTime);
      };

      const onError = () => {
        if (url) setErrorMsg('Unable to play video from the specified URL.');
      };

      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('playing', onPlaying);
      video.addEventListener('error', onError);

      return () => {
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('error', onError);
      };
    }, [url, onBufferStateChange]);

    // Expose unified PlayerRef
    useImperativeHandle(
      ref,
      () => ({
        play: async () => {
          if (provider === 'youtube' && ytPlayerRef.current) {
            ytPlayerRef.current.playVideo();
          } else if (videoRef.current) {
            await videoRef.current.play();
          }
        },
        pause: () => {
          if (provider === 'youtube' && ytPlayerRef.current) {
            ytPlayerRef.current.pauseVideo();
          } else if (videoRef.current) {
            videoRef.current.pause();
          }
        },
        seekTo: (seconds: number) => {
          if (provider === 'youtube' && ytPlayerRef.current) {
            ytPlayerRef.current.seekTo(seconds, true);
          } else if (videoRef.current) {
            videoRef.current.currentTime = seconds;
          }
          setCurrentTime(seconds);
        },
        getCurrentTime: () => {
          if (provider === 'youtube' && ytPlayerRef.current) {
            return ytPlayerRef.current.getCurrentTime() || 0;
          } else if (videoRef.current) {
            return videoRef.current.currentTime || 0;
          }
          return 0;
        },
        getDuration: () => {
          if (provider === 'youtube' && ytPlayerRef.current) {
            return ytPlayerRef.current.getDuration() || 0;
          } else if (videoRef.current) {
            return videoRef.current.duration || 0;
          }
          return 0;
        },
        setPlaybackRate: (rate: number) => {
          setPlaybackRateState(rate);
          if (provider === 'youtube' && ytPlayerRef.current) {
            ytPlayerRef.current.setPlaybackRate(rate);
          } else if (videoRef.current) {
            videoRef.current.playbackRate = rate;
          }
        },
      }),
      [provider]
    );

    return (
      <div
        ref={containerRef}
        className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center group"
      >
        {/* Autoplay block overlay */}
        {isAutoplayBlocked && <AutoplayOverlay onUnlock={onUnlockAutoplay} />}

        {/* Buffering spinner */}
        {isBuffering && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none">
            <Loader2 className="w-12 h-12 text-brand-400 animate-spin" />
          </div>
        )}

        {/* Empty URL Placeholder */}
        {!url ? (
          <div className="text-center p-6 max-w-md">
            <Film className="w-16 h-16 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-300 mb-1">No Video Loaded</h3>
            <p className="text-sm text-slate-500">
              {canControl
                ? 'Click "Change Video" or use Room Settings to load a direct MP4, HLS stream, or YouTube video.'
                : 'Waiting for the host to select a video to start the party...'}
            </p>
          </div>
        ) : errorMsg ? (
          /* Error State */
          <div className="text-center p-6 max-w-md bg-rose-950/40 border border-rose-800/50 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-rose-300 mb-1">Playback Error</h3>
            <p className="text-sm text-rose-400/90 mb-4">{errorMsg}</p>
            <p className="text-xs text-slate-400">
              Please verify the video URL is publicly reachable and CORS-enabled.
            </p>
          </div>
        ) : provider === 'youtube' ? (
          /* YouTube Embed */
          <div className="w-full h-full pointer-events-none">
            <div id="syncparty-youtube-iframe" className="w-full h-full" />
          </div>
        ) : (
          /* HTML5 Video (Direct MP4 / WebM / HLS) */
          <video
            ref={videoRef}
            playsInline
            className="w-full h-full object-contain"
            onClick={isPlaying ? onPause : onPlay}
          />
        )}

        {/* Custom Controls Bar */}
        {url && !errorMsg && (
          <CustomControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            playbackRate={playbackRate}
            canControl={canControl}
            isFullscreen={isFullscreen}
            syncStatus={syncStatus}
            driftMs={driftMs}
            qualities={qualities}
            currentQualityId={currentQualityId}
            onPlay={onPlay}
            onPause={onPause}
            onSeek={onSeek}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
            onRateChange={onRateChange}
            onQualityChange={handleQualityChange}
            onToggleFullscreen={handleToggleFullscreen}
          />
        )}
      </div>
    );
  }
);
