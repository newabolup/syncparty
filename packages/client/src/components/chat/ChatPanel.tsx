import React, { useState, useRef, useEffect } from 'react';
import { Send, Shield } from 'lucide-react';
import { ChatMessage } from '@syncparty/shared';


interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (content: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUserId,
  onSendMessage,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Messages stream */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3.5 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center p-4">
            <p>Welcome to the watch party!</p>
            <p className="mt-1">Messages and sync events will appear here.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;

            if (msg.type === 'system') {
              return (
                <div
                  key={msg.id}
                  className="flex items-center justify-center my-2"
                >
                  <span className="px-3 py-1 bg-slate-800/80 text-slate-400 text-xs rounded-full border border-slate-700/50">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {/* Sender info */}
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: msg.senderColor }}
                  />
                  <span className="text-xs font-semibold text-slate-300">
                    {msg.senderName}
                  </span>
                  {msg.senderRole === 'host' && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded">
                      <Shield className="w-2.5 h-2.5" />
                      Host
                    </span>
                  )}
                  {isMe && (
                    <span className="text-[10px] text-slate-500 font-medium">You</span>
                  )}
                  <span className="text-[10px] text-slate-500">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>

                {/* Message bubble */}
                <div
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm break-words shadow-sm ${
                    isMe
                      ? 'bg-brand-600 text-white rounded-tr-none'
                      : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/50'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-slate-950/60 border-t border-slate-800 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Send a message..."
          maxLength={500}
          className="flex-1 bg-slate-800/90 text-slate-100 text-sm placeholder-slate-500 rounded-xl px-3.5 py-2.5 outline-none border border-slate-700/60 focus:border-brand-500 transition"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="p-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:hover:bg-brand-600 text-white rounded-xl transition duration-150 flex items-center justify-center shadow-md"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
