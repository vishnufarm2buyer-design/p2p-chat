import React, { useState, useRef, useEffect } from 'react';
import { 
  Check, 
  CheckCheck, 
  Clock, 
  AlertCircle, 
  Lock, 
  FileText, 
  Download, 
  Trash2, 
  Phone, 
  Video, 
  PhoneOff,
  Reply,
  Smile,
  Edit2,
  Play,
  Pause,
  Eye,
  Flame,
  Volume2
} from 'lucide-react';
import type { LocalMessage } from '@/types';
import { localDb } from '@/services/db';

interface MessageItemProps {
  message: LocalMessage;
  isSelf: boolean;
  onDeleted?: (id: string) => void;
  onReply?: (msg: LocalMessage) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onEdit?: (messageId: string, currentContent: string) => void;
  onDeleteForEveryone?: (messageId: string) => void;
  onMediaClick?: (src: string, type: 'image' | 'video', fileName?: string) => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥', '🎉', '🔒'];

export const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  isSelf, 
  onDeleted,
  onReply,
  onReact,
  onEdit,
  onDeleteForEveryone,
  onMediaClick
}) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [isViewOnceOpened, setIsViewOnceOpened] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handleDeleteLocally = async () => {
    await localDb.deleteMessage(message.id);
    onDeleted?.(message.id);
  };

  const handleDownloadFile = () => {
    if (!message.fileMetadata) return;

    let downloadUrl = message.fileMetadata.blobUrl;
    if (!downloadUrl && message.fileMetadata.dataBlob) {
      downloadUrl = URL.createObjectURL(message.fileMetadata.dataBlob);
    }

    if (downloadUrl) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = message.fileMetadata.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleToggleAudio = () => {
    if (!message.content) return;
    if (!audioRef.current) {
      const audio = new Audio(message.content);
      audioRef.current = audio;
      audio.ontimeupdate = () => {
        if (audio.duration) {
          setAudioProgress((audio.currentTime / audio.duration) * 100);
        }
      };
      audio.onended = () => {
        setIsPlayingAudio(false);
        setAudioProgress(0);
      };
    }

    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingAudio(true);
      }).catch(console.warn);
    }
  };

  const handleOpenViewOnce = async () => {
    if (message.isViewed) return;
    setIsViewOnceOpened(true);
    if (onMediaClick && message.content) {
      onMediaClick(message.content, 'image', 'View-Once Photo');
    }
    // Burn after viewing
    await localDb.burnViewOnceMessage(message.id);
  };

  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Call Log card styling
  if (message.type === 'call_log') {
    const isVideo = message.callMetadata?.callType === 'video';
    const isMissed = message.callMetadata?.status === 'missed';

    return (
      <div className="flex justify-center my-3 select-none">
        <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-obsidian-900 border border-white/10 text-xs text-slate-300 shadow-md backdrop-blur-xl">
          {isVideo ? (
            <Video className="w-4 h-4 text-sky-400" />
          ) : isMissed ? (
            <PhoneOff className="w-4 h-4 text-rose-400" />
          ) : (
            <Phone className="w-4 h-4 text-emerald-400" />
          )}
          <span className="font-semibold">{message.content}</span>
          <span className="text-[10px] text-slate-500 font-mono">• {formattedTime}</span>
        </div>
      </div>
    );
  }

  const isImage = message.fileMetadata?.mimeType?.startsWith('image/');
  const isVideoFile = message.fileMetadata?.mimeType?.startsWith('video/');

  return (
    <div className={`flex flex-col mb-3 group relative ${isSelf ? 'items-end' : 'items-start'} select-text`}>
      <div className="flex items-end gap-1.5 max-w-[88%] sm:max-w-[75%]">
        {/* Quick Context Action Bar on hover */}
        <div
          className={`opacity-0 group-hover:opacity-100 flex items-center gap-1 mb-1 transition-opacity bg-obsidian-900/90 border border-white/10 p-1 rounded-xl shadow-lg backdrop-blur-md ${
            isSelf ? 'order-first' : 'order-last'
          }`}
        >
          {/* Reaction Picker Button */}
          <button
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            className="p-1 text-slate-400 hover:text-amber-300 rounded cursor-pointer"
            title="React"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>

          {/* Reply Button */}
          {onReply && (
            <button
              onClick={() => onReply(message)}
              className="p-1 text-slate-400 hover:text-cyan-400 rounded cursor-pointer"
              title="Reply"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Edit Button (Self text only) */}
          {isSelf && message.type === 'text' && onEdit && (
            <button
              onClick={() => onEdit(message.id, message.content)}
              className="p-1 text-slate-400 hover:text-sky-400 rounded cursor-pointer"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete for everyone (Self only) */}
          {isSelf && onDeleteForEveryone && (
            <button
              onClick={() => onDeleteForEveryone(message.id)}
              className="p-1 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
              title="Delete for everyone"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Message Bubble Card */}
        <div
          className={`rounded-2xl px-4 py-2.5 shadow-md relative transition-all duration-150 ${
            isSelf
              ? 'bg-gradient-to-tr from-cyan-600 via-sky-600 to-indigo-600 text-white rounded-br-xs shadow-cyan-600/15 border border-cyan-400/20'
              : 'bg-obsidian-900 border border-white/10 text-slate-100 rounded-bl-xs backdrop-blur-xl shadow-black/30'
          }`}
        >
          {/* Sender name for received / group messages */}
          {!isSelf && (
            <p className="text-[11px] font-bold text-cyan-400 mb-1 select-none">
              {message.senderName}
            </p>
          )}

          {/* Quoted Message Preview */}
          {message.replyTo && (
            <div className="mb-2 p-2 rounded-xl bg-black/30 border-l-3 border-cyan-300 text-xs text-slate-200 select-none">
              <span className="font-semibold text-cyan-200 block text-[11px]">
                {message.replyTo.senderName}
              </span>
              <span className="truncate block opacity-85 text-[11px]">
                {message.replyTo.content}
              </span>
            </div>
          )}

          {/* View-Once Photo Mode */}
          {message.viewOnce ? (
            <div className="py-1">
              {message.isViewed ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                  <Flame className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>View Once photo opened and deleted</span>
                </div>
              ) : (
                <button
                  onClick={handleOpenViewOnce}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer font-semibold text-xs"
                >
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span>View Once Photo (Tap to reveal)</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Text Message Content */}
              {message.type === 'text' && (
                <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              )}

              {/* Voice Note Audio Waveform Player */}
              {message.type === 'voice_note' && (
                <div className="flex items-center gap-3 py-1 min-w-[200px] sm:min-w-[240px]">
                  <button
                    onClick={handleToggleAudio}
                    className="w-10 h-10 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center hover:opacity-95 transition-transform active:scale-95 shadow-md shadow-cyan-400/30 cursor-pointer shrink-0"
                  >
                    {isPlayingAudio ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current translate-x-0.5" />
                    )}
                  </button>

                  <div className="flex-1 flex flex-col gap-1">
                    {/* Simulated/Recorded Waveform Bars */}
                    <div className="flex items-center gap-1 h-6">
                      {(message.fileMetadata?.waveform || [20, 45, 70, 30, 85, 40, 60, 95, 50, 35, 75, 20, 60]).map((h, i) => (
                        <div
                          key={i}
                          className={`w-1 rounded-full transition-all duration-150 ${
                            (i / 13) * 100 <= audioProgress
                              ? 'bg-cyan-300'
                              : 'bg-white/30'
                          }`}
                          style={{ height: `${Math.max(20, h)}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-300 font-mono">
                      <span>{isPlayingAudio ? 'Playing' : 'Voice Memo'}</span>
                      <span>
                        {message.fileMetadata?.durationSeconds
                          ? `${Math.floor(message.fileMetadata.durationSeconds / 60)}:${message.fileMetadata.durationSeconds % 60 < 10 ? '0' : ''}${message.fileMetadata.durationSeconds % 60}`
                          : '0:05'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Circular Video Note Clip */}
              {message.type === 'video_note' && (
                <div className="py-1">
                  <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-full overflow-hidden border-3 border-cyan-400 shadow-xl bg-black">
                    <video
                      src={message.content}
                      controls
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* File / Media Content */}
              {message.type === 'file' && message.fileMetadata && (
                <div className="space-y-2 select-none">
                  {/* Image Preview */}
                  {isImage && (message.fileMetadata.blobUrl || message.fileMetadata.dataBlob) && (
                    <div className="rounded-xl overflow-hidden max-w-sm max-h-64 border border-white/10 bg-black/40">
                      <img
                        src={message.fileMetadata.blobUrl || (message.fileMetadata.dataBlob ? URL.createObjectURL(message.fileMetadata.dataBlob) : '')}
                        alt={message.fileMetadata.name}
                        className="w-full h-auto object-cover max-h-64 hover:scale-105 transition-transform cursor-pointer"
                        onClick={() => {
                          const src = message.fileMetadata?.blobUrl || (message.fileMetadata?.dataBlob ? URL.createObjectURL(message.fileMetadata.dataBlob) : '');
                          if (onMediaClick && src) {
                            onMediaClick(src, 'image', message.fileMetadata?.name);
                          } else {
                            handleDownloadFile();
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* Video Preview */}
                  {isVideoFile && (message.fileMetadata.blobUrl || message.fileMetadata.dataBlob) && (
                    <div className="rounded-xl overflow-hidden max-w-sm max-h-64 border border-white/10 bg-black">
                      <video
                        src={message.fileMetadata.blobUrl || (message.fileMetadata.dataBlob ? URL.createObjectURL(message.fileMetadata.dataBlob) : '')}
                        controls
                        className="w-full max-h-64"
                      />
                    </div>
                  )}

                  {/* General File Card */}
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/30 border border-white/10 backdrop-blur-md">
                    <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate text-white">
                        {message.fileMetadata.name}
                      </p>
                      <p className="text-[10px] text-slate-300">
                        {(message.fileMetadata.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={handleDownloadFile}
                      className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white cursor-pointer"
                      title="Download File"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer Info: Lock, edited badge, timestamp & ticks */}
          <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[10px] opacity-80 select-none">
            {message.isEdited && (
              <span className="italic text-slate-300 text-[9px]">(edited)</span>
            )}
            {message.isE2EE && (
              <span className="flex items-center gap-0.5 text-cyan-200" title="Application-Level AES-256-GCM Encrypted">
                <Lock className="w-2.5 h-2.5" />
              </span>
            )}
            <span className="font-mono">{formattedTime}</span>

            {isSelf && (
              <span className="flex items-center">
                {message.status === 'queued' && (
                  <span title="Queued locally in IndexedDB Outbox">
                    <Clock className="w-3 h-3 text-amber-300" />
                  </span>
                )}
                {message.status === 'sending' && (
                  <span title="Transmitting over RTCDataChannel">
                    <Clock className="w-3 h-3 text-cyan-200 animate-spin" />
                  </span>
                )}
                {message.status === 'sent' && (
                  <span title="Sent to peer">
                    <Check className="w-3.5 h-3.5 text-slate-300" />
                  </span>
                )}
                {message.status === 'delivered' && (
                  <span title="Delivered to peer's local IndexedDB">
                    <CheckCheck className="w-3.5 h-3.5 text-slate-300" />
                  </span>
                )}
                {message.status === 'read' && (
                  <span title="Read by recipient">
                    <CheckCheck className="w-3.5 h-3.5 text-cyan-300 font-bold" />
                  </span>
                )}
                {message.status === 'failed' && (
                  <span title="Delivery failed">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-300" />
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Floating Reaction Quick Bar */}
      {showReactionPicker && (
        <div className="flex items-center gap-1 p-1.5 bg-obsidian-900 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl mt-1 z-20 animate-fade-in">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact?.(message.id, emoji);
                setShowReactionPicker(false);
              }}
              className="p-1 hover:bg-white/10 rounded-lg text-sm transition-transform active:scale-125 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Reactions List Below Message Bubble */}
      {message.reactions && Object.keys(message.reactions).length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-1 px-1">
          {Object.entries(message.reactions).map(([emoji, users]) => (
            <button
              key={emoji}
              onClick={() => onReact?.(message.id, emoji)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-obsidian-900/90 border border-white/10 text-xs shadow-sm hover:border-cyan-400/50 transition-colors cursor-pointer"
            >
              <span>{emoji}</span>
              <span className="text-[10px] text-slate-300 font-medium">{users.length}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
