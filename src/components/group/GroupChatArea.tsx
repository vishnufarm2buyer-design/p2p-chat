import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  ArrowLeft, 
  CircleDot, 
  Lock,
  Share2
} from 'lucide-react';
import type { LocalMessage, GroupItem } from '@/types';
import { MessageItem } from '../chat/MessageItem';
import { ChatInput } from '../chat/ChatInput';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { localDb } from '@/services/db';
import { groupMeshManager } from '@/services/webrtc/groupMeshManager';
import { peerManager } from '@/services/webrtc/peerManager';

export const GroupChatArea: React.FC = () => {
  const { currentUser } = useAuth();
  const { selectedChat, closeChat, sendMessage, sendFile, onlineUsers } = useChat();

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [memberStatuses, setMemberStatuses] = useState<Map<string, string>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  const group = selectedChat?.group as GroupItem | undefined;
  const groupId = group?.id || '';

  // Load message history from local database
  useEffect(() => {
    if (!groupId) return;

    let mounted = true;
    localDb.getMessages(groupId).then((history) => {
      if (mounted) setMessages(history);
    });

    const unbindMsg = peerManager.onMessageReceived((newMsg: LocalMessage) => {
      if (newMsg.conversationId === groupId && mounted) {
        setMessages((prev) => {
          const idx = prev.findIndex(m => m.id === newMsg.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = newMsg;
            return next;
          }
          return [...prev, newMsg];
        });
      }
    });

    const unbindStatus = groupMeshManager.onStatusChange((changedGroupId, statusMap) => {
      if (changedGroupId === groupId && mounted) {
        setMemberStatuses(statusMap);
      }
    });

    return () => {
      mounted = false;
      unbindMsg();
      unbindStatus();
    };
  }, [groupId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    const sent = await sendMessage(text);
    if (sent) {
      setMessages((prev) => {
        if (prev.some(m => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
    }
  };

  const handleSendFile = async (file: File) => {
    const sent = await sendFile(file);
    if (sent) {
      setMessages((prev) => {
        if (prev.some(m => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
    }
  };

  if (!group) return null;

  const totalMembers = group.members.length;
  const connectedCount = group.members.filter(m => {
    if (m.user_id === currentUser?.id) return true;
    return memberStatuses.get(m.user_id) === 'connected';
  }).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian-950 overflow-hidden relative select-none">
      {/* ── Group Header ── */}
      <div className="border-b border-white/[0.06] bg-obsidian-900/70 backdrop-blur-2xl px-3.5 sm:px-6 py-3 flex flex-col justify-center z-20 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back button on mobile */}
            <button
              onClick={closeChat}
              className="md:hidden p-2 text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              title="Back to conversations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Users className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white truncate max-w-[150px] sm:max-w-xs">{group.name}</h2>
                <span className="hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Full Mesh ({connectedCount}/{totalMembers} Live)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Zero Server Relays · Direct P2P Fan-out</span>
              </p>
            </div>
          </div>
        </div>

        {/* Member Peer Status Bar */}
        <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar">
          {group.members.map((member) => {
            const isSelf = member.user_id === currentUser?.id;
            const isOnline = onlineUsers.has(member.user_id);
            const status = memberStatuses.get(member.user_id) || 'idle';

            let statusColor = 'bg-slate-800/60 text-slate-400 border-white/5';
            if (isSelf) {
              statusColor = 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
            } else if (status === 'connected') {
              statusColor = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
            } else if (status === 'connecting') {
              statusColor = 'bg-sky-500/15 text-sky-300 border-sky-500/30 animate-pulse';
            } else if (isOnline) {
              statusColor = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
            }

            return (
              <span
                key={member.user_id}
                className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full border ${statusColor} shrink-0 font-medium`}
                title={`Status: ${isSelf ? 'You' : status}`}
              >
                <CircleDot className="w-2.5 h-2.5" />
                <span className="truncate max-w-[90px]">
                  {isSelf ? 'You' : (member.profile?.display_name || 'Member')}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Group Message Stream (Scroll container with minHeight: 0) ── */}
      <div 
        style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
        className="p-4 sm:p-6 space-y-3 bg-obsidian-950 select-text"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12 select-none">
            <div className="w-14 h-14 rounded-3xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-3 text-sky-400 shadow-xl">
              <Share2 className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-slate-200">Host-Coordinated Full Mesh</p>
            <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
              Every message and file is fanned out directly to every connected participant. The server never stores or forwards group data.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              isSelf={msg.senderId === currentUser?.id}
              onDeleted={(id) => setMessages((prev) => prev.filter((m) => m.id !== id))}
            />
          ))
        )}
        <div ref={scrollRef} />
      </div>

      {/* ── Input ── */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onSendFile={handleSendFile}
        onTyping={() => {}}
      />
    </div>
  );
};
