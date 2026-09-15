import React from 'react';
import { Play, Users, Share2, Settings, LogOut, Github, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

interface NavbarProps {
  roomName?: string;
  memberCount?: number;
  isHost?: boolean;
  onShareClick?: () => void;
  onSettingsClick?: () => void;
  onLeaveClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomName,
  memberCount,
  isHost,
  onShareClick,
  onSettingsClick,
  onLeaveClick,
}) => {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand logo */}
      <Link to="/" className="flex items-center gap-2.5 group">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-brand-500/25 group-hover:scale-105 transition transform">
          <Play className="w-5 h-5 fill-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            SyncParty
          </span>
          <span className="text-[10px] text-brand-400 font-semibold tracking-wider uppercase -mt-1">
            Authoritative Sync
          </span>
        </div>
      </Link>

      {/* Room specific header controls */}
      {roomName ? (
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden md:flex flex-col text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-sm font-bold text-white truncate max-w-[200px]">
                {roomName}
              </span>
              {isHost && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded">
                  <Shield className="w-2.5 h-2.5" />
                  Host
                </span>
              )}
            </div>
            {typeof memberCount === 'number' && (
              <span className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                <Users className="w-3 h-3" />
                {memberCount} {memberCount === 1 ? 'person' : 'people'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onShareClick && (
              <button
                onClick={onShareClick}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 border border-brand-500/30 rounded-xl text-xs font-semibold transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Invite</span>
              </button>
            )}

            {isHost && onSettingsClick && (
              <button
                onClick={onSettingsClick}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
                title="Room Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {onLeaveClick && (
              <button
                onClick={onLeaveClick}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition"
                title="Leave Room"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Landing page header */
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/newabolup/syncparty"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <Github className="w-4 h-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      )}
    </header>
  );
};
