import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, 
  Video, 
  MoreVertical, 
  Trash2, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Lock, 
  ArrowLeft, 
  UserMinus, 
  Ban, 
  Copy, 
  Check, 
  Loader2,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import type { LocalMessage } from '@/types';
import { MessageItem } from './MessageItem';
import { ChatInput } from './ChatInput';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { localDb } from '@/services/db';
import { peerManager } from '@/services/webrtc/peerManager';

export const ChatArea: React.FC = () => {
  const { currentUser } = useAuth();
  const { 
    selectedChat, 
    closeChat, 
    sendMessage, 
    sendFile, 
    sendTyping, 
    onlineUsers, 
    peerStatuses, 
    peerErrors, 
    typingUsers, 
    startCall, 
    retryPeerConnection, 
    deleteContact, 
    blockContact 
  } = useChat();

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const contactId = selectedChat?.id || '';
  const isOnline = onlineUsers.has(contactId);
  const connectionStatus = peerStatuses[contactId] || 'idle';
  const connectionError = peerErrors[contactId];
  const isPeerTyping = typingUsers[contactId];

  // Close options menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Load local message history from IndexedDB (Dexie)
  useEffect(() => {
    if (!contactId) return;

    let mounted = true;
    localDb.getMessages(contactId).then((history) => {
      if (mounted) setMessages(history);
    });

    // Listen to live message events from peerManager
    const unbind = peerManager.onMessageReceived((newMsg) => {
      if (newMsg.conversationId === contactId && mounted) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    });

    return () => {
      mounted = false;
      unbind();
    };
  }, [contactId]);

  // Auto-scroll on new messages or typing updates
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

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

  const handleClearHistory = async () => {
    if (!contactId) return;
    if (confirm('Clear local history for this contact? Messages cannot be restored from the server.')) {
      await localDb.clearConversation(contactId);
      setMessages([]);
      setShowMenu(false);
    }
  };

  const handleRemoveContact = async () => {
    if (!contactId || !selectedChat) return;
    if (confirm(`Remove ${selectedChat.name} from your contacts list?`)) {
      setShowMenu(false);
      await deleteContact(contactId);
    }
  };

  const handleBlockContact = async () => {
    if (!contactId || !selectedChat) return;
    if (confirm(`Block ${selectedChat.name}? They will not be able to send messages, call, or see your online presence.`)) {
      setShowMenu(false);
      await blockContact(contactId);
    }
  };

  const copyPublicId = () => {
    if (selectedChat?.profile?.public_id) {
      navigator.clipboard.writeText(selectedChat.profile.public_id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Zero-state placeholder when no conversation is selected
  if (!selectedChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center bg-ambient-mesh relative overflow-hidden select-none">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-500/20 via-sky-500/10 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center mb-6 text-cyan-400 shadow-2xl shadow-cyan-500/10">
          <ShieldCheck className="w-10 h-10 animate-pulse" />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Shield P2P Messenger</h3>
        <p className="text-xs sm:text-sm max-w-md text-slate-400 mb-6 leading-relaxed">
          Direct browser-to-browser encrypted communication. Your messages and media are transferred directly over WebRTC and stored only on your device.
        </p>

        {currentUser && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-cyan-300 shadow-sm">
            <span>Your Public ID:</span>
            <span className="font-bold text-white">{currentUser.public_id}</span>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            AES-256-GCM E2EE
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            STUN-Only Traversal
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
            Zero Cloud Storage
          </span>
        </div>
      </div>
    );
  }

  const isConnected = connectionStatus === 'connected';
  const isFailed = connectionStatus === 'failed';
  const isConnecting = connectionStatus === 'connecting' || connectionStatus === 'signaling';

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative select-none">
      {/* Top Chat Header */}
      <div className="h-16 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-2xl px-3 sm:px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button on mobile */}
          <button
            onClick={closeChat}
            className="md:hidden p-2 text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/10 rounded-xl transition-all cursor-pointer shrink-0"
            title="Back to conversations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Contact Avatar */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-slate-950 overflow-hidden shadow-sm">
              {selectedChat.profile?.avatar_data ? (
                <img src={selectedChat.profile.avatar_data} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                selectedChat.name.substring(0, 2).toUpperCase()
              )}
            </div>
            {/* Online Indicator */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/80' : 'bg-slate-600'
              }`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white truncate max-w-[140px] sm:max-w-xs">
                {selectedChat.name}
              </h2>
              {isConnected && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold shrink-0">
                  <Lock className="w-2.5 h-2.5" />
                  E2EE
                </span>
              )}
            </div>

            {/* Connection Status & Public ID */}
            <div className="flex items-center gap-2 text-xs">
              {isConnected && (
                <span className="text-emerald-400 font-medium text-[11px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Direct P2P
                </span>
              )}
              {isConnecting && (
                <span className="text-sky-400 text-[11px] flex items-center gap-1 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Connecting P2P...
                </span>
              )}
              {isFailed && (
                <span className="text-red-400 font-medium text-[11px] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Interrupted
                </span>
              )}
              {connectionStatus === 'idle' && (
                <span className="text-slate-400 text-[11px]">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              )}

              {/* Public ID Pill */}
              {selectedChat.profile?.public_id && (
                <button
                  onClick={copyPublicId}
                  className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-400 font-mono transition-colors cursor-pointer"
                  title="Copy public ID"
                >
                  <span>{selectedChat.profile.public_id}</span>
                  {copiedId ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Reconnect button if interrupted */}
          {(isFailed || connectionStatus === 'disconnected') && (
            <button
              onClick={() => retryPeerConnection(contactId)}
              className="p-2 sm:px-3 py-1.5 text-amber-300 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-800/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Reconnect P2P WebRTC"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Reconnect</span>
            </button>
          )}

          {/* Voice Call */}
          <button
            onClick={() => startCall('voice')}
            disabled={!isOnline}
            className="p-2.5 text-slate-300 hover:text-cyan-400 hover:bg-white/[0.06] rounded-xl transition-all disabled:opacity-30 cursor-pointer"
            title="Start Direct Voice Call"
          >
            <Phone className="w-5 h-5" />
          </button>

          {/* Video Call */}
          <button
            onClick={() => startCall('video')}
            disabled={!isOnline}
            className="p-2.5 text-slate-300 hover:text-cyan-400 hover:bg-white/[0.06] rounded-xl transition-all disabled:opacity-30 cursor-pointer"
            title="Start Direct Video Call"
          >
            <Video className="w-5 h-5" />
          </button>

          {/* Options Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all cursor-pointer"
              title="Chat Options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl py-1.5 z-40 animate-fade-in backdrop-blur-2xl">
                <button
                  onClick={handleClearHistory}
                  className="w-full px-3.5 py-2 text-left text-xs text-slate-200 hover:bg-white/[0.08] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-slate-400" />
                  <span>Clear Local History</span>
                </button>

                <div className="border-t border-white/[0.08] my-1" />

                <button
                  onClick={handleRemoveContact}
                  className="w-full px-3.5 py-2 text-left text-xs text-amber-400 hover:bg-white/[0.08] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <UserMinus className="w-4 h-4" />
                  <span>Remove Contact</span>
                </button>

                <button
                  onClick={handleBlockContact}
                  className="w-full px-3.5 py-2 text-left text-xs text-red-400 hover:bg-white/[0.08] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Ban className="w-4 h-4" />
                  <span>Block Contact</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connecting Auto-Recovery Banner */}
      {isConnecting && !isConnected && (
        <div className="bg-sky-950/70 border-b border-sky-800/60 px-4 py-2 flex items-center justify-between text-xs text-sky-200 animate-fade-in">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
            <span>Establishing direct encrypted WebRTC link (STUN hole-punching)...</span>
          </div>
          <button
            onClick={() => retryPeerConnection(contactId)}
            className="px-2.5 py-0.5 bg-sky-900 hover:bg-sky-800 text-white rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Network Failure Banner */}
      {isFailed && (
        <div className="bg-red-950/70 border-b border-red-800/60 px-4 py-2.5 flex items-center justify-between text-xs text-red-200 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              {connectionError || 'Direct connection interrupted. Network NAT/firewall prevented direct traversal.'}
            </span>
          </div>
          <button
            onClick={() => retryPeerConnection(contactId)}
            className="px-3 py-1 bg-red-900/80 hover:bg-red-800 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-ambient-mesh">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12">
            <div className="w-14 h-14 rounded-3xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3 text-cyan-400 shadow-xl">
              <Lock className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-slate-200">End-to-End Encrypted Session</p>
            <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
              Messages and files are transferred directly over WebRTC RTCDataChannel and stored only on this device.
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

        {/* Remote typing indicator */}
        {isPeerTyping && (
          <div className="flex items-center gap-2 text-xs text-cyan-400 pl-3 py-1 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>{selectedChat.name} is typing...</span>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Message & File Input Bar */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onSendFile={handleSendFile}
        onTyping={sendTyping}
        disabled={!isOnline && !isConnected}
        disabledReason={
          !isOnline 
            ? 'Contact is offline. Direct P2P messaging requires both peers to be online.'
            : !isConnected 
              ? 'Establishing direct P2P connection...' 
              : undefined
        }
      />
    </div>
  );
};
