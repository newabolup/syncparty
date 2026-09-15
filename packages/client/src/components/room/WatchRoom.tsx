import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import {
  RoomMember,
  ChatMessage,
  SOCKET_EVENTS,
} from '@syncparty/shared';
import { createSocketConnection } from '../../services/socket.js';
import { getRoomInfo } from '../../services/api.js';
import { useSyncEngine, VideoPlayerRef } from '../../hooks/useSyncEngine.js';
import { VideoPlayer } from '../player/VideoPlayer.js';
import { ChatPanel } from '../chat/ChatPanel.js';
import { ParticipantsList } from './ParticipantsList.js';
import { RoomSettingsModal } from './RoomSettingsModal.js';
import { ShareModal } from './ShareModal.js';
import { Navbar } from '../common/Navbar.js';
import {
  MessageSquare,
  Users,
  Lock,
  WifiOff,
  Loader2,
} from 'lucide-react';

interface WatchRoomProps {
  onToast: (text: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const WatchRoom: React.FC<WatchRoomProps> = ({ onToast }) => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // Connection & Room state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [roomName, setRoomName] = useState<string>('Watch Party');
  const [hasPassword, setHasPassword] = useState<boolean>(false);
  const [isHostOnlyControls, setIsHostOnlyControls] = useState<boolean>(true);
  const [currentMember, setCurrentMember] = useState<RoomMember | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);

  // Authentication & prompt state
  const [needsPassword, setNeedsPassword] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [needsUsername, setNeedsUsername] = useState<boolean>(false);
  const [usernameInput, setUsernameInput] = useState<string>('');

  const playerRef = useRef<VideoPlayerRef | null>(null);
  const isHost = currentMember?.role === 'host';

  // Core synchronization engine
  const {
    playbackState,
    driftMs,
    syncStatus,
    isAutoplayBlocked,
    unlockAutoplay,
    canControl,
    handlePlay,
    handlePause,
    handleSeek,
    handleRateChange,
    applyAuthoritativeState,
  } = useSyncEngine({
    socket,
    playerRef,
    isHost,
    isHostOnlyControls,
    onToast,
  });


  /**
   * Connect to socket and join room with credentials.
   */
  const connectAndJoin = useCallback(
    (uname: string, pwd?: string) => {
      if (!roomId) return;
      setIsLoading(true);

      const s = createSocketConnection();
      setSocket(s);

      s.on('connect', () => {
        setIsConnected(true);
        const hostToken = sessionStorage.getItem(`hostToken_${roomId}`) || undefined;

        s.emit(SOCKET_EVENTS.ROOM_JOIN, {
          roomId,
          username: uname,
          password: pwd || undefined,
          hostToken,
        });
      });

      s.on('disconnect', () => {
        setIsConnected(false);
      });

      s.on(SOCKET_EVENTS.ROOM_JOINED, (data: any) => {
        setIsLoading(false);
        setNeedsPassword(false);
        setNeedsUsername(false);
        setRoomName(data.roomName);
        setHasPassword(data.hasPassword);
        setIsHostOnlyControls(data.isHostOnlyControls);
        setCurrentMember(data.currentMember);
        setMembers(data.members);
        setMessages(data.recentMessages || []);

        if (data.hostToken) {
          sessionStorage.setItem(`hostToken_${roomId}`, data.hostToken);
        }

        applyAuthoritativeState(data.playbackState);
      });

      s.on(SOCKET_EVENTS.ROOM_MEMBERS_UPDATE, (updatedMembers: RoomMember[]) => {
        setMembers(updatedMembers);
        // Refresh my own member role
        const me = updatedMembers.find((m) => m.userId === s.id);
        if (me) setCurrentMember(me);
      });

      s.on(SOCKET_EVENTS.CHAT_RECEIVE, (msg: ChatMessage) => {
        setMessages((prev) => [...prev, msg]);
      });

      s.on(SOCKET_EVENTS.ROOM_SETTINGS_CHANGED, (settings: any) => {
        if (typeof settings.isHostOnlyControls === 'boolean') {
          setIsHostOnlyControls(settings.isHostOnlyControls);
        }
        if (typeof settings.hasPassword === 'boolean') {
          setHasPassword(settings.hasPassword);
        }
        if (settings.playbackState) {
          applyAuthoritativeState(settings.playbackState);
        }
        onToast('Room settings were updated by host', 'info');
      });

      s.on(SOCKET_EVENTS.ROOM_ERROR, (err: any) => {
        setIsLoading(false);
        if (err.code === 'AUTH_REQUIRED') {
          setNeedsPassword(true);
        }
        onToast(err.message || 'An error occurred', 'error');
      });

      s.connect();
    },
    [roomId, applyAuthoritativeState, onToast]
  );

  /**
   * Initial mount: fetch room metadata and verify session.
   */
  useEffect(() => {
    if (!roomId) return;

    const init = async () => {
      try {
        const info = await getRoomInfo(roomId);
        setRoomName(info.name);
        setHasPassword(info.hasPassword);
        setIsHostOnlyControls(info.isHostOnlyControls);

        const savedUsername = sessionStorage.getItem(`username_${roomId}`);
        const savedPassword = sessionStorage.getItem(`password_${roomId}`);

        if (!savedUsername) {
          setIsLoading(false);
          setNeedsUsername(true);
          return;
        }

        if (info.hasPassword && !savedPassword && !sessionStorage.getItem(`hostToken_${roomId}`)) {
          setIsLoading(false);
          setNeedsPassword(true);
          return;
        }

        connectAndJoin(savedUsername, savedPassword || undefined);
      } catch (err: any) {
        setIsLoading(false);
        onToast(err.message || 'Failed to locate room', 'error');
      }
    };

    init();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [roomId]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim() || !roomId) return;
    sessionStorage.setItem(`password_${roomId}`, passwordInput.trim());
    const uname = sessionStorage.getItem(`username_${roomId}`) || 'Guest';
    connectAndJoin(uname, passwordInput.trim());
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim() || !roomId) return;
    sessionStorage.setItem(`username_${roomId}`, usernameInput.trim());
    const pwd = sessionStorage.getItem(`password_${roomId}`) || undefined;
    connectAndJoin(usernameInput.trim(), pwd);
  };

  const handleSendMessage = (content: string) => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.CHAT_SEND, { content });
  };

  const handleUpdateSettings = (settings: any) => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.ROOM_SETTINGS_UPDATE, settings);
  };

  const handleBufferStateChange = (isBuffering: boolean, position: number) => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.PLAYBACK_BUFFER_STATE, { isBuffering, position });
  };

  // Render Password Modal if required
  if (needsPassword) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{roomName} is Protected</h2>
          <p className="text-xs text-slate-400 mb-6">
            This watch party requires a password to enter.
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              required
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter room password"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 outline-none transition"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition"
              >
                Back to Home
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-brand-600/30"
              >
                Enter Room
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Render Username Prompt if not set
  if (needsUsername) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center">
          <div className="w-12 h-12 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center mx-auto mb-4 border border-brand-500/30">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Join {roomName}</h2>
          <p className="text-xs text-slate-400 mb-6">Choose a nickname for the watch party.</p>

          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <input
              type="text"
              required
              autoFocus
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Your nickname"
              maxLength={30}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 outline-none transition"
            />
            <button
              type="submit"
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-brand-600/30"
            >
              Enter Watch Party
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
        <p className="text-sm font-medium text-slate-400">Connecting to synchronized room...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Navbar with room stats and buttons */}
      <Navbar
        roomName={roomName}
        memberCount={members.length}
        isHost={isHost}
        onShareClick={() => setIsShareOpen(true)}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onLeaveClick={() => navigate('/')}
      />

      {/* Disconnection Banner */}
      {!isConnected && (
        <div className="bg-amber-600/90 text-white text-xs font-semibold py-1.5 px-4 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>Connection lost. Reconnecting to sync server...</span>
        </div>
      )}

      {/* Main Layout */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Video Player & Room Actions */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <VideoPlayer
            ref={playerRef}
            url={playbackState?.url || ''}
            provider={playbackState?.provider || 'direct'}
            isPlaying={playbackState?.isPlaying || false}
            canControl={canControl}
            syncStatus={syncStatus}
            driftMs={driftMs}
            isAutoplayBlocked={isAutoplayBlocked}
            onUnlockAutoplay={unlockAutoplay}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onRateChange={handleRateChange}
            onBufferStateChange={handleBufferStateChange}
          />

          {/* Player bottom info card */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">{roomName}</span>
              {isHostOnlyControls && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                  <Lock className="w-3 h-3 text-amber-400" /> Host Controls
                </span>
              )}
            </div>

            {isHost && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-3 py-1.5 bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 border border-brand-500/30 rounded-xl font-medium transition"
              >
                Change Video Source
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Chat & Participants Sidebar */}
        <div className="lg:col-span-1 flex flex-col h-[650px] lg:h-auto min-h-[500px]">
          {/* Tabs header */}
          <div className="flex items-center gap-2 mb-3 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition ${
                activeTab === 'chat'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition ${
                activeTab === 'participants'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              People ({members.length})
            </button>
          </div>

          {/* Active Tab View */}
          <div className="flex-1 h-0">
            {activeTab === 'chat' ? (
              <ChatPanel
                messages={messages}
                currentUserId={currentMember?.userId || ''}
                onSendMessage={handleSendMessage}
              />
            ) : (
              <ParticipantsList
                members={members}
                currentUserId={currentMember?.userId || ''}
              />
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <RoomSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isHostOnlyControls={isHostOnlyControls}
        hasPassword={hasPassword}
        currentVideoUrl={playbackState?.url || ''}
        onUpdateSettings={handleUpdateSettings}
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        roomSlug={roomId || ''}
        roomName={roomName}
      />
    </div>
  );
};
