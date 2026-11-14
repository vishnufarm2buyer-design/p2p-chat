import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Loader2 } from 'lucide-react';
import { soundEngine } from '@/services/audio';

interface VoiceNoteRecorderProps {
  onSendVoiceNote: (audioBlobUrl: string, waveform: number[], durationSeconds: number) => Promise<void>;
  onCancel: () => void;
}

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({
  onSendVoiceNote,
  onCancel
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>([15, 25, 40, 20, 60, 30, 75, 45, 80, 50, 35, 65, 40, 20]);
  const [isSending, setIsSending] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const samplesRef = useRef<number[]>([]);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  const startRecording = async () => {
    try {
      soundEngine.playRecordStart();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      audioStreamRef.current = stream;

      // Web Audio API analyzer for real-time waveform bars
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateWaveform = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Sample 16 frequency points
        const bars: number[] = [];
        let sum = 0;
        for (let i = 0; i < 16; i++) {
          const val = Math.max(10, Math.round((dataArray[i * 2] / 255) * 100));
          bars.push(val);
          sum += val;
        }
        setWaveformBars(bars);
        samplesRef.current.push(Math.round(sum / 16));

        animFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      animFrameRef.current = requestAnimationFrame(updateWaveform);

      // MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start voice recording:', err);
      alert('Microphone permission denied or not available: ' + err.message);
      onCancel();
    }
  };

  const handleStopAndSend = async () => {
    if (!mediaRecorderRef.current || isSending) return;
    setIsSending(true);
    soundEngine.playRecordStop();

    const recorder = mediaRecorderRef.current;
    recorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Convert to data URL for persistent IndexedDB storage
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          // Downsample samples to ~30 normalized bars for the player
          const rawSamples = samplesRef.current;
          const barCount = 30;
          const normalizedBars: number[] = [];
          const step = Math.max(1, Math.floor(rawSamples.length / barCount));
          for (let i = 0; i < rawSamples.length && normalizedBars.length < barCount; i += step) {
            normalizedBars.push(Math.min(100, Math.max(15, rawSamples[i])));
          }
          while (normalizedBars.length < 20) {
            normalizedBars.push(20);
          }

          cleanup();
          await onSendVoiceNote(base64Audio, normalizedBars, recordingSeconds || 1);
        };
        reader.readAsDataURL(audioBlob);
      } catch (err: any) {
        console.error('Failed to finalize voice note:', err);
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-3 w-full bg-obsidian-950/90 border border-rose-500/40 rounded-2xl px-3 py-2 animate-fade-in shadow-xl shadow-rose-950/20">
      {/* Blinking Recording Dot */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
        <span className="text-xs font-mono font-semibold text-rose-400">
          {formatTime(recordingSeconds)}
        </span>
      </div>

      {/* Dynamic Waveform Visualizer */}
      <div className="flex-1 flex items-center justify-center gap-[3px] h-8 px-2 overflow-hidden">
        {waveformBars.map((height, i) => (
          <div
            key={i}
            className="w-1 bg-gradient-to-t from-rose-500 to-cyan-400 rounded-full transition-all duration-75"
            style={{ height: `${Math.max(15, height)}%` }}
          />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Cancel Button */}
        <button
          onClick={handleCancel}
          disabled={isSending}
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
          title="Discard Voice Note"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        {/* Send Button */}
        <button
          onClick={handleStopAndSend}
          disabled={isSending}
          className="p-2 bg-gradient-to-tr from-cyan-500 to-sky-400 hover:opacity-95 text-slate-950 font-bold rounded-xl transition-all shadow-md shadow-cyan-500/30 cursor-pointer"
          title="Send Voice Memo"
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
