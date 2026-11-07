import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string) => Promise<void>;
  onSendFile: (file: File) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onSendFile,
  onTyping,
  disabled = false,
  disabledReason
}) => {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const maxFileSizeMb = Number(import.meta.env.VITE_MAX_FILE_SIZE_MB || 50);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    // Typing debounce
    onTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const sizeMb = file.size / (1024 * 1024);

      if (sizeMb > maxFileSizeMb) {
        alert(`File is too large (${sizeMb.toFixed(1)}MB). Max P2P limit is ${maxFileSizeMb}MB.`);
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleSend = async () => {
    if (disabled || isSending) return;

    if (selectedFile) {
      setIsSending(true);
      try {
        await onSendFile(selectedFile);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        alert('File transfer failed: ' + err.message);
      } finally {
        setIsSending(false);
      }
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    setIsSending(true);
    setText('');
    onTyping(false);

    try {
      await onSendMessage(trimmed);
    } catch (err: any) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="border-t border-slate-800 bg-slate-950/90 backdrop-blur p-3 sm:p-4">
      {/* Disabled warning if offline or peer disconnected */}
      {disabled && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-center justify-between">
          <span>{disabledReason || 'Direct P2P connection not established.'}</span>
        </div>
      )}

      {/* Selected file preview pill */}
      {selectedFile && (
        <div className="mb-3 flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-cyan-800/60 max-w-md">
          <div className="flex items-center gap-2 truncate">
            <Paperclip className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs text-slate-200 truncate">{selectedFile.name}</span>
            <span className="text-[10px] text-slate-400">
              ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
            </span>
          </div>
          <button
            onClick={() => setSelectedFile(null)}
            className="p-1 hover:text-red-400 text-slate-400 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Hidden File Picker */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Attach File Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isSending}
          className="p-3 text-slate-400 hover:text-cyan-400 hover:bg-slate-900 rounded-xl transition-colors disabled:opacity-40 cursor-pointer shrink-0"
          title="Send File, Image, or Video (Direct P2P)"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Text Input Area */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 focus-within:border-cyan-500 transition-colors">
          <textarea
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              disabled 
                ? 'Direct connection required to send messages...' 
                : 'Type an encrypted peer message... (Enter to send)'
            }
            rows={1}
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none max-h-32 min-h-[24px]"
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={disabled || isSending || (!text.trim() && !selectedFile)}
          className="p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20 cursor-pointer shrink-0"
          title="Send"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};
