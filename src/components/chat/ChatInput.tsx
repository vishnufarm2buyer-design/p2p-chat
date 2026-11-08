import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Loader2, Smile, Clock } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string) => Promise<void>;
  onSendFile: (file: File) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
  isQueuingAllowed?: boolean;
}

const COMMON_EMOJIS = ['👍', '❤️', '😊', '🔥', '🎉', '🔒', '✨', '👋'];

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onSendFile,
  onTyping,
  disabled = false,
  disabledReason,
  isQueuingAllowed = true
}) => {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const maxFileSizeMb = Number(import.meta.env.VITE_MAX_FILE_SIZE_MB || 50);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

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
        alert(`File is too large (${sizeMb.toFixed(1)}MB). Max direct P2P limit is ${maxFileSizeMb}MB.`);
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleSend = async () => {
    if (isSending) return;

    if (selectedFile) {
      if (disabled) {
        alert('Direct P2P DataChannel must be open to stream large files. Check connection status.');
        return;
      }
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
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const addEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const isTextSendAllowed = !disabled || isQueuingAllowed;

  return (
    <div className="border-t border-white/[0.06] bg-obsidian-900/80 backdrop-blur-2xl p-2.5 sm:p-4 pb-safe select-none shrink-0 relative">
      {/* Quick Emoji Bar */}
      {showEmojiPicker && (
        <div className="absolute bottom-full left-4 mb-2 p-2 bg-obsidian-900 border border-white/10 rounded-2xl shadow-2xl flex items-center gap-1.5 backdrop-blur-2xl animate-fade-in z-30">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => addEmoji(emoji)}
              className="p-1.5 hover:bg-white/10 rounded-xl text-lg transition-transform active:scale-125 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => setShowEmojiPicker(false)}
            className="p-1 text-slate-500 hover:text-white rounded ml-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Outbox / Connection Notice */}
      {disabled && isQueuingAllowed && (
        <div className="mb-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>P2P link reconnecting · Messages will queue locally in IndexedDB Outbox</span>
          </span>
        </div>
      )}

      {/* Selected file preview pill */}
      {selectedFile && (
        <div className="mb-2.5 flex items-center justify-between p-2 rounded-xl bg-obsidian-850 border border-cyan-500/40 max-w-md animate-fade-in">
          <div className="flex items-center gap-2 truncate">
            <Paperclip className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs text-white truncate font-medium">{selectedFile.name}</span>
            <span className="text-[10px] text-slate-400">
              ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
            </span>
          </div>
          <button
            onClick={() => setSelectedFile(null)}
            className="p-1 hover:text-rose-400 text-slate-400 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Pill Input Bar */}
      <div className="flex items-end gap-2 bg-obsidian-950/70 border border-white/[0.08] focus-within:border-cyan-500/50 rounded-2xl p-1.5 sm:p-2 transition-all shadow-inner">
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
          className="p-2 sm:p-2.5 text-slate-400 hover:text-cyan-400 hover:bg-white/[0.06] rounded-xl transition-all disabled:opacity-30 cursor-pointer shrink-0"
          title={disabled ? 'Direct connection required for file transfer' : 'Send File, Image, or Video'}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Emoji Button */}
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-2 sm:p-2.5 text-slate-400 hover:text-amber-300 hover:bg-white/[0.06] rounded-xl transition-all cursor-pointer shrink-0"
          title="Quick Emoji"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Auto-expanding Textarea */}
        <div className="flex-1 min-w-0 py-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled && !isQueuingAllowed
                ? (disabledReason || 'Direct connection required...') 
                : 'Type an encrypted peer message...'
            }
            rows={1}
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none max-h-28 min-h-[22px] leading-relaxed"
          />
        </div>

        {/* Send Action Button */}
        <button
          onClick={handleSend}
          disabled={!isTextSendAllowed || isSending || (!text.trim() && !selectedFile)}
          className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-indigo-600 hover:opacity-95 text-slate-950 font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md shadow-cyan-500/20 active:scale-95 cursor-pointer shrink-0"
          title="Send Encrypted Message"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
          ) : (
            <Send className="w-5 h-5 text-slate-950" />
          )}
        </button>
      </div>
    </div>
  );
};
