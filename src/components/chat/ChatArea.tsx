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
  Loader2
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

  // Close menu when clicking outside
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

  // 1. Load local message history from IndexedDB (Dexie)
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

  // Scroll to bottom on messages update
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

  if (!selectedChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 bg-slate-950">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-cyan-400 shadow-xl shadow-cyan-950/20">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-300 mb-1">Select a Peer to Chat</h3>
        <p className="text-xs max-w-sm text-slate-400">
          Direct, zero-cloud peer-to-peer messaging. Connections are established automatically when contacts are online.
        </p>
      </div>
    );
  }

  const isConnected = connectionStatus === 'connected';
  const isFailed = connectionStatus === 'failed';
  const isConnecting = connectionStatus === 'connecting' || connectionStatus === 'signaling';

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* Chat Header */}
      <div className="h-16 border-b border-slate-800/90 bg-slate-950/80 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Back button on mobile */}
          <button
            onClick={closeChat}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 cursor-pointer shrink-0 transition-colors"
            title="Back to contacts"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Contact Avatar */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-sky-500 flex items-center justify-center text-sm font-bold text-slate-950 overflow-hidden shadow-md">
              {selectedChat.profile?.avatar_data ? (
                <img src={selectedChat.profile.avatar_data} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                selectedChat.name.substring(0, 2).toUpperCase()
              )}
            </div>
            {/* Online Indicator */}
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-950 transition-colors ${
                isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'
              }`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-sm font-bold text-white truncate max-w-[140px] sm:max-w-xs">{selectedChat.name}</h2>
              {isConnected && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-medium shrink-0">
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
                <span className="text-sky-400 text-[11px] flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Connecting...
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
                  className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-400 font-mono transition-colors"
                  title="Click to copy public ID"
                >
                  <span>{selectedChat.profile.public_id}</span>
                  {copiedId ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Reconnect button */}
          {(isFailed || connectionStatus === 'disconnected') && (
            <button
              onClick={() => retryPeerConnection(contactId)}
              className="p-2 text-amber-400 hover:bg-amber-950/40 rounded-xl transition-colors cursor-pointer border border-amber-900/40"
              title="Reconnect P2P WebRTC"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Voice Call */}
          <button
            onClick={() => startCall('voice')}
            disabled={!isOnline}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-900 rounded-xl transition-colors disabled:opacity-30 cursor-pointer"
            title="Start Voice Call"
          >
            <Phone className="w-4.5 h-4.5" />
          </button>

          {/* Video Call */}
          <button
            onClick={() => startCall('video')}
            disabled={!isOnline}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-900 rounded-xl transition-colors disabled:opacity-30 cursor-pointer"
            title="Start Video Call"
          >
            <Video className="w-4.5 h-4.5" />
          </button>

          {/* Options Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition-colors cursor-pointer"
              title="Chat Options"
            >
              <MoreVertical className="w-4.5 h-4.5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl py-1.5 z-30 divide-y divide-slate-800/60 animate-scale-in">
                <div className="px-3 py-1.5">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Contact Actions</p>
                </div>
                
                <div className="py-1">
                  <button
                    onClick={handleClearHistory}
                    className="w-full px-4 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-slate-400" />
                    Clear Chat History
                  </button>
                </div>

                <div className="py-1">
                  <button
                    onClick={handleRemoveContact}
                    className="w-full px-4 py-2 text-left text-xs text-amber-400 hover:bg-amber-950/40 flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <UserMinus className="w-4 h-4" />
                    Remove Contact
                  </button>

                  <button
                    onClick={handleBlockContact}
                    className="w-full px-4 py-2 text-left text-xs text-red-400 hover:bg-red-950/40 flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <Ban className="w-4 h-4" />
                    Block Contact
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Network Auto-Recovery Banner */}
      {isConnecting && !isConnected && (
        <div className="bg-sky-950/60 border-b border-sky-900/60 px-4 py-2 flex items-center justify-between text-xs text-sky-300">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
            <span>Establishing direct encrypted WebRTC link (STUN hole-punching)...</span>
          </div>
          <button
            onClick={() => retryPeerConnection(contactId)}
            className="px-2 py-0.5 bg-sky-900/80 hover:bg-sky-800 text-sky-200 rounded text-[11px] font-medium cursor-pointer transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Network Failure Banner */}
      {isFailed && (
        <div className="bg-red-950/60 border-b border-red-900/60 px-4 py-2.5 flex items-center justify-between text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              {connectionError || 'Direct connection interrupted. Network NAT/firewall prevented direct traversal.'}
            </span>
          </div>
          <button
            onClick={() => retryPeerConnection(contactId)}
            className="px-2.5 py-1 bg-red-900/70 hover:bg-red-800 text-white rounded text-[11px] font-medium cursor-pointer transition-colors shrink-0"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 text-cyan-400 shadow-lg">
              <Lock className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-300">End-to-End Encrypted Session</p>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
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
          <div className="flex items-center gap-2 text-xs text-cyan-400 animate-pulse pl-2 py-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>{selectedChat.name} is typing...</span>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Message & File Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onSendFile={handleSendFile}
        onTyping={sendTyping}
        disabled={!isOnline && !isConnected}
        disabledReason={
          !isOnline 
            ? 'Contact is offline. Direct P2P messaging requires both peers to be online.'
            : !isConnected 
              ? 'Securing direct P2P connection...' 
              : undefined
        }
      />
    </div>
  );
};
