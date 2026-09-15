import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Play,
  LogIn,
  Zap,
  Radio,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { createRoom } from '../../services/api.js';
import { SYNC_CONSTANTS } from '@syncparty/shared';

interface LandingPageProps {
  onToast: (text: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onToast }) => {
  const navigate = useNavigate();

  // Create Room state
  const [roomName, setRoomName] = useState('');
  const [hostUsername, setHostUsername] = useState('');
  const [password, setPassword] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isHostOnlyControls, setIsHostOnlyControls] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Join Room state
  const [joinCode, setJoinCode] = useState('');
  const [joinUsername, setJoinUsername] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || !hostUsername.trim()) {
      onToast('Please provide both room name and your username', 'warning');
      return;
    }

    try {
      setIsCreating(true);
      const res = await createRoom({
        name: roomName.trim(),
        hostUsername: hostUsername.trim(),
        password: password.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        isHostOnlyControls,
      });

      // Save credentials for host session
      sessionStorage.setItem(`hostToken_${res.slug}`, res.hostToken);
      sessionStorage.setItem(`username_${res.slug}`, hostUsername.trim());

      onToast('Room created successfully! Launching party...', 'success');
      navigate(`/room/${res.slug}`);
    } catch (err: any) {
      onToast(err.message || 'Failed to create room', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !joinUsername.trim()) {
      onToast('Please enter room code and your username', 'warning');
      return;
    }

    // Extract slug if user pasted a full URL
    let slug = joinCode.trim();
    if (slug.includes('/room/')) {
      slug = slug.split('/room/')[1].split('?')[0].split('#')[0];
    }

    sessionStorage.setItem(`username_${slug}`, joinUsername.trim());
    if (joinPassword.trim()) {
      sessionStorage.setItem(`password_${slug}`, joinPassword.trim());
    }

    navigate(`/room/${slug}`);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-slate-950">
      {/* Hero Section */}
      <section className="relative px-4 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          Server-Authoritative Clock Synchronization
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.15] mb-6">
          Watch Videos Together in{' '}
          <span className="bg-gradient-to-r from-brand-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            Perfect Sync
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto mb-12">
          SyncParty pairs server-authoritative timestamps, dual-threshold drift correction,
          and multi-provider video streaming so you and your friends never miss a single frame.
        </p>

        {/* Action Cards: Create & Join */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto">
          {/* Create Room Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur relative overflow-hidden group hover:border-slate-700 transition">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl group-hover:bg-brand-500/20 transition" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
                <Play className="w-5 h-5 fill-brand-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Create a Room</h2>
                <p className="text-xs text-slate-400">Host your own synchronized watch party</p>
              </div>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Room Name *
                </label>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Movie Night Marathon"
                  maxLength={50}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Your Nickname *
                </label>
                <input
                  type="text"
                  required
                  value={hostUsername}
                  onChange={(e) => setHostUsername(e.target.value)}
                  placeholder="e.g. Captain"
                  maxLength={30}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Initial Video URL (Optional)
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Direct MP4, HLS (.m3u8), or YouTube"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 outline-none transition"
                />

                {/* Quick samples */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-500 self-center">Try:</span>
                  {SYNC_CONSTANTS.DEFAULT_SAMPLE_VIDEOS.slice(0, 2).map((s) => (
                    <button
                      type="button"
                      key={s.label}
                      onClick={() => setVideoUrl(s.url)}
                      className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 hover:text-brand-300 rounded border border-slate-700"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password (Optional)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank for public room"
                  maxLength={64}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 outline-none transition"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-300 font-medium">
                  Host-Only Controls
                </span>
                <button
                  type="button"
                  onClick={() => setIsHostOnlyControls(!isHostOnlyControls)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    isHostOnlyControls ? 'bg-brand-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      isHostOnlyControls ? 'translate-x-4.5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full mt-4 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition transform active:scale-95"
              >
                {isCreating ? 'Creating Room...' : 'Start Watch Party'}
              </button>
            </form>
          </div>

          {/* Join Room Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur relative overflow-hidden group hover:border-slate-700 transition flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <LogIn className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Join a Room</h2>
                  <p className="text-xs text-slate-400">Enter room code or paste the shared invite URL</p>
                </div>
              </div>

              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Room Code or URL *
                  </label>
                  <input
                    type="text"
                    required
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="e.g. k92kLm9 or https://..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Your Nickname *
                  </label>
                  <input
                    type="text"
                    required
                    value={joinUsername}
                    onChange={(e) => setJoinUsername(e.target.value)}
                    placeholder="e.g. Guest123"
                    maxLength={30}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Room Password (If required)
                  </label>
                  <input
                    type="password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Password for protected rooms"
                    maxLength={64}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition transform active:scale-95"
                >
                  Join Watch Party
                </button>
              </form>
            </div>

            {/* Quick feature summary */}
            <div className="mt-8 pt-6 border-t border-slate-800/80 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Automatic sub-second playback synchronization
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                No extensions or third-party accounts required
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="border-t border-slate-800/80 bg-slate-900/40 py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Engineered for Real-Time Precision
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Traditional watch parties fail due to broadcast delays and desynchronization.
              SyncParty solves this with a server-authoritative time engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center mb-4">
                <Radio className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Authoritative Clock Engine</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                NTP-style clock offset estimation continuously measures network RTT and jitter,
                ensuring all clients calculate the exact server-side video position.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Dual-Threshold Drift Control</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Minor drift (0.25s–2s) is corrected invisibly by slightly nudging playback rate
                (0.95x / 1.05x), avoiding jarring audio stutter. Hard seeks only occur when necessary.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Multi-Provider Video Engine</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Supports Direct MP4/WebM files, adaptive bitrate HLS (.m3u8) streams via Hls.js,
                and YouTube video embeds with synchronized controls.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
