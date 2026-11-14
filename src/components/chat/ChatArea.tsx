import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Sparkles,
  Globe,
  Search,
  X,
  Palette,
  Gamepad2,
  Timer,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import type { LocalMessage } from '@/types';
import { MessageItem } from './MessageItem';
import { ChatInput } from './ChatInput';
import { MediaLightbox } from './MediaLightbox';
import { WhiteboardModal } from './WhiteboardModal';
import { GameModal } from './GameModal';
import { SafetyNumberModal } from '../security/SafetyNumberModal';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { localDb } from '@/services/db';
import { peerManager } from '@/services/webrtc/peerManager';

export const ChatArea: React.FC<Record<string, any>> = () => {
  const { currentUser } = useAuth();
  const { 
    selectedChat, 
    closeChat, 
    sendMessage, 
    sendFile, 
    sendReaction,
    editMessage,
    deleteMessageForEveryone,
    markMessagesAsRead,
    setDisappearingTimer,
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

  // Search in chat
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocalMessage[]>([]);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);

  // Quoted Reply & Message Edit
  const [replyingTo, setReplyingTo] = useState<LocalMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);

  // Disappearing messages timer
  const [disappearingTimer, setLocalDisappearingTimer] = useState<number>(0);

  // Interactive Modals
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [showSafetyNumber, setShowSafetyNumber] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<{ src: string; type: 'image' | 'video'; name?: string } | null>(null);

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

  // Load conversation settings (e.g. disappearingTimer)
  useEffect(() => {
    if (!contactId) return;
    localDb.getConversation(contactId).then((conv) => {
      if (conv?.disappearingTimer) {
        setLocalDisappearingTimer(conv.disappearingTimer);
      } else {
        setLocalDisappearingTimer(0);
      }
    });
  }, [contactId]);

  // Load local message history from IndexedDB (Dexie) & setup read receipts
  useEffect(() => {
    if (!contactId) return;

    let mounted = true;
    localDb.getMessages(contactId).then((history) => {
      if (mounted) {
        setMessages(history);
        // Mark unread incoming messages as read
        const unreadIds = history
          .filter((m) => m.senderId !== currentUser?.id && m.status !== 'read')
          .map((m) => m.id);
        if (unreadIds.length > 0) {
          markMessagesAsRead(unreadIds);
        }
      }
    });

    const unbind = peerManager.onMessageReceived((newMsg) => {
      if (newMsg.conversationId === contactId && mounted) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === newMsg.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = newMsg;
            return next;
          }
          return [...prev, newMsg];
        });

        // Auto mark incoming message as read
        if (newMsg.senderId !== currentUser?.id) {
          markMessagesAsRead([newMsg.id]);
        }
      }
    });

    return () => {
      mounted = false;
      unbind();
    };
  }, [contactId, currentUser?.id, markMessagesAsRead]);

  // Search handler
  useEffect(() => {
    if (!searchQuery.trim() || !contactId) {
      setSearchResults([]);
      setSearchMatchIndex(0);
      return;
    }
    localDb.searchMessages(contactId, searchQuery).then((res) => {
      setSearchResults(res);
      setSearchMatchIndex(0);
    });
  }, [searchQuery, contactId]);

  const scrollToSearchMatch = (index: number) => {
    if (searchResults.length === 0) return;
    const targetMsg = searchResults[index];
    if (targetMsg) {
      const el = document.getElementById(`msg-${targetMsg.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleNextSearch = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (searchMatchIndex + 1) % searchResults.length;
    setSearchMatchIndex(nextIdx);
    scrollToSearchMatch(nextIdx);
  };

  const handlePrevSearch = () => {
    if (searchResults.length === 0) return;
    const prevIdx = (searchMatchIndex - 1 + searchResults.length) % searchResults.length;
    setSearchMatchIndex(prevIdx);
    scrollToSearchMatch(prevIdx);
  };

  // Auto-scroll on new messages or typing updates
  useEffect(() => {
    if (!isSearching) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isPeerTyping, isSearching]);

  const handleSendMessage = async (
    text: string, 
    options?: {
      type?: any;
      replyTo?: any;
      viewOnce?: boolean;
      waveform?: number[];
      durationSeconds?: number;
    }
  ) => {
    const sent = await sendMessage(text, options);
    if (sent) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
    }
  };

  const handleSendFile = async (file: File) => {
    const sent = await sendFile(file);
    if (sent) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
    }
  };

  const handleSendVoiceNote = async (audioBlobUrl: string, waveform: number[], durationSeconds: number) => {
    await handleSendMessage(audioBlobUrl, {
      type: 'voice_note',
      waveform,
      durationSeconds
    });
  };

  const handleSendVideoNote = async (videoDataUrl: string, durationSeconds: number) => {
    await handleSendMessage(videoDataUrl, {
      type: 'video_note',
      durationSeconds
    });
  };

  const handleReact = async (messageId: string, emoji: string) => {
    await sendReaction(messageId, emoji);
  };

  const handleEdit = (messageId: string, currentContent: string) => {
    setEditingMessage({ id: messageId, content: currentContent });
  };

  const handleSaveEdit = async (messageId: string, newContent: string) => {
    await editMessage(messageId, newContent);
    setEditingMessage(null);
  };

  const handleDeleteForEveryone = async (messageId: string) => {
    if (confirm('Delete this message for everyone?')) {
      await deleteMessageForEveryone(messageId);
    }
  };

  const handleUpdateTimer = async (seconds: number) => {
    setLocalDisappearingTimer(seconds);
    await setDisappearingTimer(seconds);
  };

  const handleClearHistory = async () => {
    if (!contactId) return;
    if (confirm('Clear local history for this contact? Messages cannot be restored.')) {
      await localDb.clearConversation(contactId);
      setMessages([]);
      setShowMenu(false);
    }
  };

  const handleRemoveContact = async () => {
    if (!contactId || !selectedChat) return;
    if (confirm(`Remove ${selectedChat.name} from contacts?`)) {
      setShowMenu(false);
      await deleteContact(contactId);
    }
  };

  const handleBlockContact = async () => {
    if (!contactId || !selectedChat) return;
    if (confirm(`Block ${selectedChat.name}? They will not be able to connect or message you.`)) {
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center bg-obsidian-950 relative overflow-hidden select-none">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-500/20 via-sky-500/10 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center mb-6 text-cyan-400 shadow-2xl shadow-cyan-500/10 animate-pulse-ring">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">Shield P2P Messenger</h3>
        <p className="text-xs sm:text-sm max-w-md text-slate-400 mb-6 leading-relaxed">
          Direct browser-to-browser encrypted communication. Messages and media are transferred directly over WebRTC RTCDataChannel and stored only on this device.
        </p>

        {currentUser && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-cyan-300 shadow-sm mb-6">
            <span className="text-slate-400">Your Permanent ID:</span>
            <span className="font-bold text-white">{currentUser.public_id}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>AES-256-GCM E2EE</span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>STUN-Only Traversal</span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>Zero Cloud Storage</span>
          </span>
        </div>
      </div>
    );
  }

  const isConnected = connectionStatus === 'connected';
  const isFailed = connectionStatus === 'failed';
  const isConnecting = connectionStatus === 'connecting' || connectionStatus === 'signaling';

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian-950 overflow-hidden relative select-none">
      {/* Interactive Feature Modals */}
      {showWhiteboard && (
        <WhiteboardModal
          peerUserId={contactId}
          peerUserName={selectedChat.name}
          onClose={() => setShowWhiteboard(false)}
        />
      )}

      {showGame && currentUser && (
        <GameModal
          peerUserId={contactId}
          peerUserName={selectedChat.name}
          currentUserId={currentUser.id}
          onClose={() => setShowGame(false)}
        />
      )}

      {showSafetyNumber && currentUser && (
        <SafetyNumberModal
          peerUserId={contactId}
          peerUserName={selectedChat.name}
          currentUserId={currentUser.id}
          onClose={() => setShowSafetyNumber(false)}
        />
      )}

      {lightboxMedia && (
        <MediaLightbox
          src={lightboxMedia.src}
          type={lightboxMedia.type}
          fileName={lightboxMedia.name}
          onClose={() => setLightboxMedia(null)}
        />
      )}

      {/* ── Modern Top Chat Header ── */}
      <div className="h-16 border-b border-white/[0.06] bg-obsidian-900/70 backdrop-blur-2xl px-3.5 sm:px-6 flex items-center justify-between z-20 shrink-0">
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
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 flex items-center justify-center text-sm font-black text-slate-950 overflow-hidden shadow-sm">
              {selectedChat.profile?.avatar_data ? (
                <img src={selectedChat.profile.avatar_data} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                selectedChat.name.substring(0, 2).toUpperCase()
              )}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-obsidian-950 ${
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
                <button
                  onClick={() => setShowSafetyNumber(true)}
                  className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold shrink-0 hover:bg-emerald-500/20 cursor-pointer"
                  title="Verify Safety Number"
                >
                  <Lock className="w-2.5 h-2.5" />
                  E2EE Verified
                </button>
              )}
              {disappearingTimer > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                  <Timer className="w-2.5 h-2.5" />
                  {disappearingTimer < 60 ? `${disappearingTimer}s` : disappearingTimer < 3600 ? `${disappearingTimer/60}m` : `${disappearingTimer/3600}h`}
                </span>
              )}
            </div>

            {/* Connection Status */}
            <div className="flex items-center gap-2 text-xs">
              {isConnected && (
                <span className="text-emerald-400 font-medium text-[11px] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  Direct P2P (STUN)
                </span>
              )}

              {isConnecting && (
                <span className="text-sky-400 text-[11px] flex items-center gap-1 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Establishing P2P link...
                </span>
              )}

              {isFailed && (
                <span className="text-rose-400 font-medium text-[11px] flex items-center gap-1">
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
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* In-chat Search Toggle */}
          <button
            onClick={() => setIsSearching(!isSearching)}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              isSearching ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
            }`}
            title="Search Messages"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Collaborative Whiteboard */}
          <button
            onClick={() => setShowWhiteboard(true)}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-white/[0.06] rounded-xl transition-all cursor-pointer"
            title="Open Live P2P Whiteboard"
          >
            <Palette className="w-4 h-4" />
          </button>

          {/* Interactive Mini-Game */}
          <button
            onClick={() => setShowGame(true)}
            className="p-2 text-slate-300 hover:text-indigo-400 hover:bg-white/[0.06] rounded-xl transition-all cursor-pointer"
            title="Play Tic-Tac-Toe"
          >
            <Gamepad2 className="w-4 h-4" />
          </button>

          {/* Reconnect button if interrupted */}
          {(isFailed || connectionStatus === 'disconnected') && (
            <button
              onClick={() => retryPeerConnection(contactId)}
              className="p-2 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Reconnect P2P WebRTC"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Voice Call */}
          <button
            onClick={() => startCall('voice')}
            disabled={!isOnline}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-white/[0.06] rounded-xl transition-all disabled:opacity-30 cursor-pointer"
            title="Start Direct Voice Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Video Call */}
          <button
            onClick={() => startCall('video')}
            disabled={!isOnline}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-white/[0.06] rounded-xl transition-all disabled:opacity-30 cursor-pointer"
            title="Start Direct Video Call"
          >
            <Video className="w-4 h-4" />
          </button>

          {/* Options Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all cursor-pointer"
              title="Chat Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-obsidian-900 border border-white/10 rounded-2xl shadow-2xl py-1.5 z-40 animate-fade-in backdrop-blur-2xl">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowSafetyNumber(true);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs text-slate-200 hover:bg-white/[0.08] flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>Verify Safety Number</span>
                </button>

                <button
                  onClick={handleClearHistory}
                  className="w-full px-3.5 py-2 text-left text-xs text-slate-200 hover:bg-white/[0.08] flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-slate-400" />
                  <span>Clear Local History</span>
                </button>

                <div className="border-t border-white/[0.08] my-1" />

                <button
                  onClick={handleRemoveContact}
                  className="w-full px-3.5 py-2 text-left text-xs text-amber-400 hover:bg-white/[0.08] flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <UserMinus className="w-4 h-4" />
                  <span>Remove Contact</span>
                </button>

                <button
                  onClick={handleBlockContact}
                  className="w-full px-3.5 py-2 text-left text-xs text-rose-400 hover:bg-white/[0.08] flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <Ban className="w-4 h-4" />
                  <span>Block Contact</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* In-chat Search Sub-Header Bar */}
      {isSearching && (
        <div className="bg-obsidian-900 border-b border-white/[0.08] px-4 py-2 flex items-center gap-3 animate-fade-in z-10">
          <Search className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            type="text"
            placeholder="Search in this chat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
            autoFocus
          />
          {searchResults.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
              <span>{searchMatchIndex + 1} / {searchResults.length}</span>
              <button
                onClick={handlePrevSearch}
                className="p-1 hover:text-white rounded"
                title="Previous"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextSearch}
                className="p-1 hover:text-white rounded"
                title="Next"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
          <button
            onClick={() => {
              setIsSearching(false);
              setSearchQuery('');
            }}
            className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connecting Auto-Recovery Banner */}
      {isConnecting && !isConnected && (
        <div className="bg-sky-950/60 border-b border-sky-800/50 px-4 py-2 flex items-center justify-between text-xs text-sky-200 animate-fade-in">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
            <span>Establishing direct encrypted WebRTC link (STUN hole-punching)...</span>
          </div>
          <button
            onClick={() => retryPeerConnection(contactId)}
            className="px-2.5 py-0.5 bg-sky-900/80 hover:bg-sky-800 text-white rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Network Failure Banner */}
      {isFailed && (
        <div className="bg-rose-950/60 border-b border-rose-800/50 px-4 py-2.5 flex items-center justify-between text-xs text-rose-200 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              {connectionError || 'Direct connection interrupted. Network NAT/firewall prevented direct traversal.'}
            </span>
          </div>
          <button
            onClick={() => retryPeerConnection(contactId)}
            className="px-3 py-1 bg-rose-900/80 hover:bg-rose-800 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Message Stream (Scroll container with minHeight: 0) ── */}
      <div 
        style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
        className="p-4 sm:p-6 space-y-3 bg-obsidian-950"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12 select-none">
            <div className="w-14 h-14 rounded-3xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-3 text-cyan-400 shadow-xl">
              <Lock className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-slate-200">End-to-End Encrypted Session</p>
            <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
              Messages and files are transferred directly over WebRTC RTCDataChannel and stored only on this device.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} id={`msg-${msg.id}`}>
              <MessageItem
                message={msg}
                isSelf={msg.senderId === currentUser?.id}
                onDeleted={(id) => setMessages((prev) => prev.filter((m) => m.id !== id))}
                onReply={(m) => setReplyingTo(m)}
                onReact={handleReact}
                onEdit={handleEdit}
                onDeleteForEveryone={handleDeleteForEveryone}
                onMediaClick={(src, type, name) => setLightboxMedia({ src, type, name })}
              />
            </div>
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

      {/* ── Floating Chat Input Bar ── */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onSendFile={handleSendFile}
        onSendVoiceNote={handleSendVoiceNote}
        onSendVideoNote={handleSendVideoNote}
        onTyping={sendTyping}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
        onSaveEdit={handleSaveEdit}
        disappearingTimer={disappearingTimer}
        onSetDisappearingTimer={handleUpdateTimer}
        disabled={!isOnline && !isConnected}
        disabledReason={
          !isOnline 
            ? 'Contact is offline. Messages will queue in Outbox.'
            : !isConnected 
              ? 'Establishing direct P2P connection...' 
              : undefined
        }
        isQueuingAllowed={true}
      />
    </div>
  );
};
