import React from 'react';
import { RoomMember } from '@syncparty/shared';
import { Crown, Loader2 } from 'lucide-react';


interface ParticipantsListProps {
  members: RoomMember[];
  currentUserId: string;
}

export const ParticipantsList: React.FC<ParticipantsListProps> = ({
  members,
  currentUserId,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl p-4">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <h3 className="text-sm font-bold text-slate-200">
          Participants ({members.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {members.map((member) => {
          const isMe = member.userId === currentUserId;
          return (
            <div
              key={member.userId}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40 hover:bg-slate-800 transition"
            >
              <div className="flex items-center gap-3">
                {/* Avatar dot / initial */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow"
                  style={{ backgroundColor: member.avatarColor }}
                >
                  {member.username.charAt(0).toUpperCase()}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-200">
                      {member.username}
                    </span>
                    {isMe && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-brand-500/20 text-brand-300 font-medium rounded">
                        You
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 capitalize">
                    {member.role}
                  </span>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-2">
                {member.isBuffering && (
                  <span
                    className="flex items-center gap-1 text-[11px] text-amber-400"
                    title="Buffering..."
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  </span>
                )}
                {member.role === 'host' && (
                  <div
                    className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg"
                    title="Room Host"
                  >
                    <Crown className="w-4 h-4" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
