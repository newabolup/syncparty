import React, { useState } from 'react';
import { X, Shield, Sparkles } from 'lucide-react';
import { SYNC_CONSTANTS } from '@syncparty/shared';


interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHostOnlyControls: boolean;
  hasPassword: boolean;
  currentVideoUrl: string;
  onUpdateSettings: (settings: {
    isHostOnlyControls?: boolean;
    password?: string | null;
    videoUrl?: string;
  }) => void;
}

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  isOpen,
  onClose,
  isHostOnlyControls,
  hasPassword,
  currentVideoUrl,
  onUpdateSettings,
}) => {
  const [videoUrl, setVideoUrl] = useState(currentVideoUrl);
  const [hostOnly, setHostOnly] = useState(isHostOnlyControls);
  const [password, setPassword] = useState('');
  const [removePassword, setRemovePassword] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const updates: {
      isHostOnlyControls?: boolean;
      password?: string | null;
      videoUrl?: string;
    } = {};

    if (hostOnly !== isHostOnlyControls) {
      updates.isHostOnlyControls = hostOnly;
    }

    if (videoUrl.trim() !== currentVideoUrl) {
      updates.videoUrl = videoUrl.trim();
    }

    if (removePassword) {
      updates.password = null;
    } else if (password.trim()) {
      updates.password = password.trim();
    }

    onUpdateSettings(updates);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-400" />
            Room Settings
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto">
          {/* Video URL */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">
              Current Video URL
            </label>
            <div className="relative">
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://... (.mp4, .m3u8, YouTube, Vimeo)"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 outline-none transition"
              />
            </div>

            {/* Quick-pick sample videos */}
            <div className="mt-2.5">
              <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3 h-3 text-brand-400" /> Or pick a verified test stream:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SYNC_CONSTANTS.DEFAULT_SAMPLE_VIDEOS.map((sample) => (
                  <button
                    type="button"
                    key={sample.label}
                    onClick={() => setVideoUrl(sample.url)}
                    className="text-[11px] px-2.5 py-1 bg-slate-800/80 hover:bg-brand-600/30 text-slate-300 hover:text-brand-300 border border-slate-700/60 rounded-lg transition"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Host Only Controls Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl">
            <div>
              <div className="text-sm font-semibold text-white">Host-Only Playback Controls</div>
              <div className="text-xs text-slate-400 mt-0.5">
                When enabled, only the host can play, pause, seek, or change video.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHostOnly(!hostOnly)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                hostOnly ? 'bg-brand-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  hostOnly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Password Protection */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">
              {hasPassword ? 'Change or Remove Password' : 'Add Room Password'}
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                disabled={removePassword}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasPassword ? 'Enter new password to change' : 'Leave empty for no password'}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 outline-none transition disabled:opacity-40"
              />
            </div>
            {hasPassword && (
              <label className="flex items-center gap-2 mt-2 text-xs text-rose-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={removePassword}
                  onChange={(e) => setRemovePassword(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-rose-500 focus:ring-0"
                />
                Remove current password (make room public)
              </label>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/25 transition"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
