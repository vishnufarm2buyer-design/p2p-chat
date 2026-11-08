import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Lock 
} from 'lucide-react';
import { useChat } from '@/context/ChatContext';

export const CallOverlay: React.FC = () => {
  const { 
    activeCall, 
    localStream, 
    remoteStream, 
    endCall, 
    toggleMute, 
    toggleVideo 
  } = useChat();

  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(activeCall.isMuted);
  const [isVideoOff, setIsVideoOff] = useState(activeCall.isVideoOff);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const isActive = activeCall.active && (!activeCall.isIncoming || activeCall.status === 'connected');

  // Attach local stream to video tag
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.warn('Local video play warning:', e));
    }
  }, [localStream, isActive]);

  // Attach remote stream to video and audio tags with explicit play()
  useEffect(() => {
    if (!remoteStream || !isActive) return;

    if (activeCall.callType === 'video') {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(e => {
          console.warn('Remote video element play error, trying audio fallback:', e);
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(console.warn);
          }
        });
      }
    } else {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(e => console.warn('Remote audio play warning:', e));
      }
    }
  }, [remoteStream, activeCall.callType, isActive]);

  // Call duration counter
  useEffect(() => {
    if (!isActive || activeCall.status !== 'connected') {
      setCallSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      if (activeCall.startedAt) {
        setCallSeconds(Math.floor((Date.now() - activeCall.startedAt) / 1000));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, activeCall.status, activeCall.startedAt]);

  if (!isActive) return null;

  const handleToggleMute = () => {
    const muted = toggleMute();
    setIsMuted(muted);
  };

  const handleToggleVideo = () => {
    const videoOff = toggleVideo();
    setIsVideoOff(videoOff);
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isVideo = activeCall.callType === 'video';
  const isConnected = activeCall.status === 'connected';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-4 sm:p-6 animate-fade-in select-none">
      {/* Hidden audio element for voice calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Top Status Bar */}
      <div className="flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-white text-sm">
            {activeCall.remoteUserName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{activeCall.remoteUserName}</h3>
            <div className="flex items-center gap-2 text-xs">
              {isConnected ? (
                <span className="text-emerald-400 font-medium">
                  Connected ({formatDuration(callSeconds)})
                </span>
              ) : (
                <span className="text-cyan-400 animate-pulse">
                  {activeCall.status === 'ringing' ? 'Ringing...' : 'Negotiating Direct WebRTC...'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Security & Direct P2P Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-cyan-300">
          <Lock className="w-3.5 h-3.5" />
          <span>Direct P2P MediaStream (No Relay)</span>
        </div>
      </div>

      {/* Main Video or Audio Canvas */}
      <div className="flex-1 my-4 relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
        {isVideo && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          /* Voice Call / Waiting Placeholder */
          <div className="flex flex-col items-center justify-center text-center p-6">
            <div className="relative mb-6">
              {isConnected && (
                <div className="absolute inset-0 rounded-full bg-cyan-500/10 animate-radar" />
              )}
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center font-bold text-slate-950 text-4xl shadow-2xl relative z-10">
                {activeCall.remoteUserName.substring(0, 2).toUpperCase()}
              </div>
            </div>
            <h4 className="text-xl font-bold text-white mb-1">{activeCall.remoteUserName}</h4>
            <p className="text-xs text-slate-400 max-w-xs">
              {isConnected 
                ? 'Direct browser-to-browser encrypted audio stream active.' 
                : 'Waiting for peer to accept direct connection...'}
            </p>
          </div>
        )}

        {/* Local Video Thumbnail (PIP) */}
        {isVideo && localStream && !isVideoOff && (
          <div className="absolute bottom-4 right-4 w-32 sm:w-44 aspect-video rounded-2xl overflow-hidden border-2 border-cyan-500/80 shadow-2xl bg-black">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          </div>
        )}
      </div>

      {/* Call Controls Bar */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 z-20">
        {/* Mute Microphone */}
        <button
          onClick={handleToggleMute}
          className={`w-13 h-13 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            isMuted 
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' 
              : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-800'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Video (if video call) */}
        {isVideo && (
          <button
            onClick={handleToggleVideo}
            className={`w-13 h-13 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isVideoOff 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' 
                : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-800'
            }`}
            title={isVideoOff ? 'Enable Camera' : 'Disable Camera'}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}

        {/* End Call */}
        <button
          onClick={endCall}
          className="w-13 h-13 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition-transform hover:scale-105 cursor-pointer"
          title="End Call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
