import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Lock,
  Volume2,
  SwitchCamera,
  Monitor,
  ShieldCheck,
  Maximize2
} from 'lucide-react';
import { useChat } from '@/context/ChatContext';

export const CallOverlay: React.FC = () => {
  const { 
    activeCall, 
    localStream, 
    remoteStream, 
    endCall, 
    toggleMute, 
    toggleVideo,
    flipCamera,
    toggleScreenShare
  } = useChat();

  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(activeCall.isMuted);
  const [isVideoOff, setIsVideoOff] = useState(activeCall.isVideoOff);
  const [needsAudioGesture, setNeedsAudioGesture] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

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

    // 1. Audio element exclusively handles the audio track
    if (remoteAudioRef.current) {
      const audioTracks = remoteStream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks.forEach(t => { t.enabled = true; });
        remoteAudioRef.current.srcObject = new MediaStream(audioTracks);
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.play().then(() => {
          setNeedsAudioGesture(false);
        }).catch(e => {
          console.warn('[WebRTC Audio] Remote audio element play error:', e);
          setNeedsAudioGesture(true);
        });
      }
    }

    // 2. Video element handles video track with muted={true} to prevent autoplay violations & audio conflicts
    if (activeCall.callType === 'video' && remoteVideoRef.current) {
      const videoTracks = remoteStream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach(t => { t.enabled = true; });
        remoteVideoRef.current.srcObject = new MediaStream(videoTracks);
        remoteVideoRef.current.play().catch(e => {
          console.warn('[WebRTC Video] Remote video element play error:', e);
        });
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

  const handleFlipCamera = async () => {
    if (isFlipping) return;
    setIsFlipping(true);
    await flipCamera();
    setIsFlipping(false);
  };

  const handleToggleScreenShare = async () => {
    await toggleScreenShare();
  };

  const handleTogglePiP = async () => {
    try {
      if (remoteVideoRef.current && document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await remoteVideoRef.current.requestPictureInPicture();
        }
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isVideo = activeCall.callType === 'video';
  const isConnected = activeCall.status === 'connected';

  const handleUnlockAudio = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().then(() => setNeedsAudioGesture(false)).catch(console.warn);
    }
  };

  return (
    <div 
      onClick={needsAudioGesture ? handleUnlockAudio : undefined}
      className="fixed inset-0 z-50 bg-obsidian-950 flex flex-col justify-between p-4 sm:p-6 animate-fade-in select-none"
    >
      {/* Hidden audio element for audio track playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Autoplay Fallback Unlocker Banner */}
      {needsAudioGesture && (
        <button 
          onClick={handleUnlockAudio}
          className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-cyan-400 hover:bg-cyan-300 text-slate-950 px-5 py-2.5 rounded-full font-bold text-xs shadow-2xl cursor-pointer animate-bounce flex items-center gap-2 border-2 border-white"
        >
          <Volume2 className="w-4 h-4 animate-pulse" />
          <span>Tap here to enable call audio</span>
        </button>
      )}

      {/* ── Top Status Bar ── */}
      <div className="flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-600 to-indigo-600 flex items-center justify-center font-bold text-slate-950 text-sm shadow-md">
            {activeCall.remoteUserName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{activeCall.remoteUserName}</h3>
            <div className="flex items-center gap-2 text-xs">
              {isConnected ? (
                <span className="text-emerald-400 font-semibold font-mono">
                  Connected ({formatDuration(callSeconds)})
                </span>
              ) : (
                <span className="text-cyan-400 animate-pulse font-medium">
                  {activeCall.status === 'ringing' ? 'Ringing...' : 'Negotiating Direct WebRTC...'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Security & Direct P2P Badge */}
        <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs text-cyan-300 font-medium">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>Direct P2P E2EE</span>
        </div>
      </div>

      {/* ── Media Viewport ── */}
      <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden rounded-3xl bg-black/50 border border-white/10 backdrop-blur-md">
        {isVideo ? (
          <>
            {/* Remote Video Stream (muted so browser never blocks video and audio is handled exclusively by remoteAudioRef) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover rounded-3xl"
            />

            {/* Local Video Stream Picture-in-Picture */}
            <div className="absolute top-4 right-4 w-28 sm:w-44 aspect-video rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-900 z-10">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {isVideoOff && (
                <div className="absolute inset-0 bg-slate-900/90 flex items-center justify-center text-xs text-slate-400 font-medium">
                  Camera Off
                </div>
              )}
            </div>
          </>
        ) : (
          /* Voice Call Avatar & Radar Visual */
          <div className="flex flex-col items-center justify-center text-center p-8">
            <div className="relative mb-6">
              {/* Animated Radar Rings */}
              <div className="absolute -inset-4 rounded-full bg-cyan-500/20 animate-radar" />
              <div className="absolute -inset-8 rounded-full bg-cyan-500/10 animate-radar delay-300" />

              <div className="relative w-28 h-28 rounded-full bg-gradient-to-tr from-cyan-500 via-sky-500 to-indigo-600 flex items-center justify-center text-3xl font-black text-slate-950 shadow-2xl shadow-cyan-500/30">
                {activeCall.remoteUserName.substring(0, 2).toUpperCase()}
              </div>
            </div>

            <h2 className="text-xl font-bold text-white mb-1">{activeCall.remoteUserName}</h2>
            <p className="text-xs text-slate-400 max-w-xs mb-3">
              {isConnected ? 'Direct STUN Voice Stream' : 'Direct P2P Ringing...'}
            </p>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-slate-400 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero Relay · Direct WebRTC</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Modern Floating Bottom Control Dock ── */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 p-3 z-20 pb-safe">
        <div className="flex items-center gap-2.5 sm:gap-3 px-5 py-3 rounded-full bg-obsidian-900/80 border border-white/10 backdrop-blur-2xl shadow-2xl">
          {/* Mute Button */}
          <button
            onClick={handleToggleMute}
            className={`p-3.5 rounded-full transition-all cursor-pointer ${
              isMuted
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Video Toggle Button (for video calls) */}
          {isVideo && (
            <button
              onClick={handleToggleVideo}
              className={`p-3.5 rounded-full transition-all cursor-pointer ${
                isVideoOff
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title={isVideoOff ? 'Enable camera' : 'Disable camera'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          )}

          {/* Flip Camera Button (for mobile/video calls) */}
          {isVideo && (
            <button
              onClick={handleFlipCamera}
              disabled={isFlipping}
              className="p-3.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer disabled:opacity-50"
              title="Flip Camera (Front / Rear)"
            >
              <SwitchCamera className={`w-5 h-5 ${isFlipping ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Screen Share Button */}
          {isVideo && (
            <button
              onClick={handleToggleScreenShare}
              className="p-3.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer"
              title="Toggle Screen Sharing"
            >
              <Monitor className="w-5 h-5 text-sky-400" />
            </button>
          )}

          {/* Picture in Picture Button */}
          {isVideo && typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && (
            <button
              onClick={handleTogglePiP}
              className="p-3.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer"
              title="Picture in Picture Mode"
            >
              <Maximize2 className="w-5 h-5 text-cyan-400" />
            </button>
          )}

          {/* End Call Button */}
          <button
            onClick={endCall}
            className="p-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-600/30 active:scale-95 cursor-pointer ml-1"
            title="End Call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
