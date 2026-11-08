import React, { useEffect, useRef } from 'react';
import { Phone, Video, PhoneOff } from 'lucide-react';
import { useChat } from '@/context/ChatContext';

export const IncomingCallDialog: React.FC = () => {
  const { activeCall, acceptCall, rejectCall } = useChat();
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<any>(null);

  const isIncoming = activeCall.active && activeCall.isIncoming && activeCall.status === 'ringing';

  // Synthesize ringing sound with Web Audio API (zero external assets needed)
  useEffect(() => {
    if (!isIncoming) {
      if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
        const playTone = () => {
          if (!audioContextRef.current) return;
          const ctx = audioContextRef.current;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.setValueAtTime(480, ctx.currentTime + 0.1);

          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start();
          osc.stop(ctx.currentTime + 0.8);
        };

        playTone();
        ringIntervalRef.current = setInterval(playTone, 2000);
      }
    } catch (_) {}

    return () => {
      if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [isIncoming]);

  if (!isIncoming) return null;

  const isVideo = activeCall.callType === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-obsidian-900 border border-white/10 rounded-3xl p-6 text-center shadow-2xl backdrop-blur-2xl flex flex-col items-center">
        {/* Caller Avatar with Animated Radar Ring */}
        <div className="relative mb-6 mt-2">
          <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-radar" />
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center font-bold text-slate-950 text-3xl shadow-xl relative z-10">
            {activeCall.remoteUserName.substring(0, 2).toUpperCase()}
          </div>
        </div>

        <h3 className="text-lg font-bold text-white mb-1">{activeCall.remoteUserName}</h3>
        <p className="text-xs text-cyan-400 flex items-center gap-1.5 font-medium mb-6">
          {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
          Incoming Direct P2P {isVideo ? 'Video' : 'Voice'} Call
        </p>

        <p className="text-[11px] text-slate-400 mb-8 max-w-xs">
          Direct browser-to-browser WebRTC MediaStream. Audio/Video never passes through a cloud relay.
        </p>

        {/* Accept / Reject Buttons */}
        <div className="flex items-center justify-center gap-6 w-full">
          {/* Reject */}
          <button
            onClick={rejectCall}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-transform hover:scale-105 cursor-pointer"
            title="Decline"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          {/* Accept */}
          <button
            onClick={() => acceptCall(activeCall.callType)}
            className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-transform hover:scale-105 cursor-pointer"
            title="Accept"
          >
            {isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
};
