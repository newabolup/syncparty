import React, { useState } from 'react';
import { X, Copy, Check, Share2, Link } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomSlug: string;
  roomName: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  roomSlug,
  roomName,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const shareUrl = `${window.location.origin}${basePath}/room/${roomSlug}`;


  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-brand-400" />
            Invite Friends
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-300">
            Share this link with anyone you want to invite to <strong className="text-white">{roomName}</strong>:
          </p>

          <div className="flex items-center gap-2 p-2.5 bg-slate-800 border border-slate-700 rounded-xl">
            <Link className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-transparent text-sm text-slate-200 outline-none select-all"
            />
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-brand-600 hover:bg-brand-500 text-white'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/40 text-xs text-slate-400">
            💡 Anyone with this link can join the room. All viewers will remain in sub-second sync automatically.
          </div>
        </div>
      </div>
    </div>
  );
};
