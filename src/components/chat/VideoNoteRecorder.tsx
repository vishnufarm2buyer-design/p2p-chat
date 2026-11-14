import React, { useState, useRef, useEffect } from 'react';
import { Video, Square, Trash2, Send, Loader2, X } from 'lucide-react';
import { soundEngine } from '@/services/audio';

interface VideoNoteRecorderProps {
  onSendVideoNote: (videoDataUrl: string, durationSeconds: number) => Promise<void>;
  onCancel: () => void;
}

export const VideoNoteRecorder: React.FC<VideoNoteRecorderProps> = ({
  onSendVideoNote,
  onCancel
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const maxSeconds = 60;

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    initCamera();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  const initCamera = async () => {
    try {
      soundEngine.playRecordStart();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 480, max: 720 },
          height: { ideal: 480, max: 720 },
          aspectRatio: 1
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      mediaStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;

      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev >= maxSeconds - 1) {
            handleFinish();
            return maxSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Camera error for video note:', err);
      alert('Camera access denied or unavailable: ' + err.message);
      onCancel();
    }
  };

  const handleFinish = async () => {
    if (!mediaRecorderRef.current || isSending) return;
    setIsSending(true);
    soundEngine.playRecordStop();

    const recorder = mediaRecorderRef.current;
    recorder.onstop = () => {
      try {
        const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Data = reader.result as string;
          cleanup();
          await onSendVideoNote(base64Data, seconds || 1);
        };
        reader.readAsDataURL(videoBlob);
      } catch (err: any) {
        console.error('Failed to encode video memo:', err);
        cleanup();
        onCancel();
      }
    };

    recorder.stop();
  };

  const handleCancel = () => {
    soundEngine.playRecordStop();
    cleanup();
    onCancel();
  };

  const progressPercent = (seconds / maxSeconds) * 100;
  const strokeDashoffset = 283 - (283 * progressPercent) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative flex flex-col items-center gap-6">
        {/* Circular Masked Camera Preview */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border-4 border-cyan-400 shadow-2xl shadow-cyan-500/30">
          <video
            ref={videoPreviewRef}
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />

          {/* SVG Progress Ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#06b6d4"
              strokeWidth="4"
              strokeDasharray="283"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>

          {/* Timer Badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-obsidian-950/80 border border-cyan-400/50 backdrop-blur-md text-xs font-mono font-bold text-cyan-300">
            {seconds}s / {maxSeconds}s
          </div>
        </div>

        {/* Floating Controls */}
        <div className="flex items-center gap-4 bg-obsidian-900/90 border border-white/10 px-5 py-2.5 rounded-2xl backdrop-blur-2xl shadow-2xl">
          <button
            onClick={handleCancel}
            disabled={isSending}
            className="p-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-all cursor-pointer"
            title="Cancel"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          <button
            onClick={handleFinish}
            disabled={isSending}
            className="p-4 bg-gradient-to-tr from-cyan-500 to-sky-400 hover:opacity-95 text-slate-950 font-bold rounded-full transition-all shadow-lg shadow-cyan-500/30 active:scale-95 cursor-pointer"
            title="Send Video Memo"
          >
            {isSending ? (
              <Loader2 className="w-6 h-6 animate-spin text-slate-950" />
            ) : (
              <Send className="w-6 h-6 text-slate-950" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
