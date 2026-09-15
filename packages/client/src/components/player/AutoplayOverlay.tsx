import React from 'react';
import { Volume2, Play } from 'lucide-react';

interface AutoplayOverlayProps {
  onUnlock: () => void;
}

export const AutoplayOverlay: React.FC<AutoplayOverlayProps> = ({ onUnlock }) => {
  return (
    <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center shadow-2xl animate-fade-in">
        <div className="w-16 h-16 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-500/30">
          <Volume2 className="w-8 h-8 animate-pulse" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Browser Autoplay Blocked</h3>
        <p className="text-slate-300 text-sm mb-6">
          Your browser requires user interaction before allowing synchronized audio and video playback.
        </p>
        <button
          onClick={onUnlock}
          className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition duration-150 transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Play className="w-5 h-5 fill-white" />
          Click to Unmute & Sync Playback
        </button>
      </div>
    </div>
  );
};
