import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Share2, 
  ArrowLeft,
  CircleDot
} from 'lucide-react';
import type { LocalMessage, PeerConnectionStatus } from '@/types';
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
  const [memberStatuses, setMemberStatuses] = useState<Map<string, PeerConnectionStatus>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  const groupId = selectedChat?.id || '';
  const group = selectedChat?.group;

  // 1. Load local message history
  useEffect(() => {
    if (!groupId) return;

    let mounted = true;
    localDb.getMessages(groupId).then((history) => {
      if (mounted) setMessages(history);
    });

    const unbindMsg = peerManager.onMessageReceived((newMsg) => {
      // In group messages, we tag content or senderId
      if (newMsg.conversationId === groupId && mounted) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    });

    const unbindStatus = groupMeshManager.onStatusChange((gid, statusMap) => {
      if (gid === groupId && mounted) {
        setMemberStatuses(new Map(statusMap));
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
      setMessages((prev) => [...prev, sent]);
    }
  };

  const handleSendFile = async (file: File) => {
    const sent = await sendFile(file);
    if (sent) {
      setMessages((prev) => [...prev, sent]);
    }
  };

  if (!group) return null;

  const totalMembers = group.members.length;
  // Mesh connection count: N * (N - 1) / 2
  const totalMeshLines = Math.floor((totalMembers * (totalMembers - 1)) / 2);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* Group Header */}
      <div className="h-20 border-b border-slate-800/90 bg-slate-950/80 backdrop-blur px-4 flex flex-col justify-center z-10 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={closeChat}
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Users className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">{group.name}</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800/60">
                  Full Mesh ({totalMeshLines} P2P Links)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {totalMembers} members • Zero Central Relay
              </p>
            </div>
          </div>
        </div>

        {/* Member Peer Status Bar */}
        <div className="flex items-center gap-2 mt-1.5 overflow-x-auto no-scrollbar">
          {group.members.map((member) => {
            const isSelf = member.user_id === currentUser?.id;
            const isOnline = onlineUsers.has(member.user_id);
            const status = memberStatuses.get(member.user_id) || 'idle';

            let statusColor = 'bg-slate-700 text-slate-400 border-slate-800';
            if (isSelf) {
              statusColor = 'bg-cyan-950 text-cyan-300 border-cyan-800/60';
            } else if (status === 'connected') {
              statusColor = 'bg-emerald-950 text-emerald-300 border-emerald-800/60';
            } else if (status === 'connecting') {
              statusColor = 'bg-sky-950 text-sky-300 border-sky-800/60 animate-pulse';
            } else if (isOnline) {
              statusColor = 'bg-amber-950 text-amber-300 border-amber-800/60';
            }

            return (
              <span
                key={member.user_id}
                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${statusColor} shrink-0`}
                title={`Status: ${isSelf ? 'You' : status}`}
              >
                <CircleDot className="w-2.5 h-2.5" />
                <span className="truncate max-w-[80px]">
                  {isSelf ? 'You' : (member.profile?.display_name || 'Member')}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Group Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 text-sky-400">
              <Share2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-300">Host-Coordinated Full Mesh</p>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Every message and file is fanned out directly to every connected participant. The host never stores or forwards group data.
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

      {/* Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onSendFile={handleSendFile}
        onTyping={() => {}}
      />
    </div>
  );
};
