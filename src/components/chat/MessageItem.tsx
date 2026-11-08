import React from 'react';
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
  PhoneOff 
} from 'lucide-react';
import type { LocalMessage } from '@/types';
import { localDb } from '@/services/db';

interface MessageItemProps {
  message: LocalMessage;
  isSelf: boolean;
  onDeleted?: (id: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, isSelf, onDeleted }) => {
  const handleDelete = async () => {
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
        <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/80 border border-white/10 text-xs text-slate-300 shadow-md backdrop-blur-xl">
          {isVideo ? (
            <Video className="w-4 h-4 text-sky-400" />
          ) : isMissed ? (
            <PhoneOff className="w-4 h-4 text-red-400" />
          ) : (
            <Phone className="w-4 h-4 text-emerald-400" />
          )}
          <span className="font-medium">{message.content}</span>
          <span className="text-[10px] text-slate-500 font-mono">• {formattedTime}</span>
        </div>
      </div>
    );
  }

  const isImage = message.fileMetadata?.mimeType?.startsWith('image/');
  const isVideoFile = message.fileMetadata?.mimeType?.startsWith('video/');

  return (
    <div className={`flex flex-col mb-3 group ${isSelf ? 'items-end' : 'items-start'} select-text`}>
      <div className="flex items-end gap-1.5 max-w-[88%] sm:max-w-[72%]">
        {/* Delete action button on hover for self messages */}
        {isSelf && (
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 transition-all rounded-lg cursor-pointer mb-1 shrink-0"
            title="Delete locally"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Message Bubble Card */}
        <div
          className={`rounded-2xl px-4 py-2.5 shadow-md relative transition-all duration-200 ${
            isSelf
              ? 'bg-gradient-to-tr from-cyan-600 via-sky-600 to-indigo-600 text-white rounded-br-xs shadow-cyan-600/10'
              : 'bg-slate-900/90 border border-white/[0.08] text-slate-100 rounded-bl-xs backdrop-blur-xl shadow-black/20'
          }`}
        >
          {/* Sender name for received / group messages */}
          {!isSelf && (
            <p className="text-[11px] font-bold text-cyan-400 mb-1 select-none">
              {message.senderName}
            </p>
          )}

          {/* Text Message Content */}
          {message.type === 'text' && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
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
                    onClick={handleDownloadFile}
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
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/25 border border-white/10 backdrop-blur-md">
                <div className="w-9 h-9 rounded-xl bg-cyan-950 flex items-center justify-center text-cyan-400 shrink-0">
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

          {/* Footer Info: Lock, timestamp & ticks */}
          <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[10px] opacity-80 select-none">
            {message.isE2EE && (
              <span className="flex items-center gap-0.5 text-cyan-200" title="Application-Level AES-256-GCM Encrypted">
                <Lock className="w-3 h-3" />
              </span>
            )}
            <span className="font-mono">{formattedTime}</span>

            {isSelf && (
              <span>
                {message.status === 'sending' && <Clock className="w-3 h-3 animate-spin" />}
                {message.status === 'sent' && <Check className="w-3 h-3 text-cyan-200" />}
                {message.status === 'delivered' && <CheckCheck className="w-3 h-3 text-cyan-100" />}
                {message.status === 'failed' && (
                  <span title="Delivery failed (Peer offline or disconnected)">
                    <AlertCircle className="w-3 h-3 text-red-300" />
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Delete action button for incoming messages */}
        {!isSelf && (
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 transition-all rounded-lg cursor-pointer mb-1 shrink-0"
            title="Delete locally"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
