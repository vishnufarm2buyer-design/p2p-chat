import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Network, 
  QrCode, 
  HardDrive, 
  ArrowRight,
  ServerOff,
  Radio,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const LandingPage: React.FC = () => {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Navbar */}
      <nav className="h-16 border-b border-slate-800/80 px-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center shadow-lg shadow-cyan-950/50">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-wide">P2P Shield Chat</span>
        </div>
        <button
          onClick={signInWithGoogle}
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-semibold text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center gap-2"
        >
          Sign In with Google
          <ArrowRight className="w-4 h-4" />
        </button>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 md:py-20 flex flex-col items-center text-center">
        {/* Core Vision Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-800/70 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-8">
          <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
          Zero-Cloud Peer-to-Peer Architecture
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-tight sm:leading-none mb-6">
          The server connects people; <br />
          <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
            their devices communicate.
          </span>
        </h1>

        <p className="text-base sm:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          A truly decentralized, installable PWA messenger. Chat messages, file transfers, voice calls, and video calls travel directly browser-to-browser via WebRTC.
        </p>

        {/* Call to Action */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-16">
          <button
            onClick={signInWithGoogle}
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold text-base rounded-2xl transition-all shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-3 cursor-pointer"
          >
            <ShieldCheck className="w-5 h-5" />
            Get Started with Google OAuth
          </button>
          <a
            href="#architecture"
            className="w-full sm:w-auto px-6 py-4 bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-sm rounded-2xl border border-slate-800 transition-all flex items-center justify-center gap-2"
          >
            Explore Architecture
          </a>
        </div>

        {/* Interactive Architecture Flow Diagram */}
        <section id="architecture" className="w-full bg-slate-900/60 border border-slate-800/90 rounded-3xl p-6 sm:p-10 text-left mb-16 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Network className="w-6 h-6 text-cyan-400" />
            Architectural Separation of Concerns
          </h2>
          <p className="text-sm text-slate-400 mb-8">
            How Shield P2P guarantees privacy by eliminating server-side message handling.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* The Server Card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Minimal Server Role</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/50">Identity & Signaling</span>
              </div>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Google authentication & session verification</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Public identity profile & permanent unique ID</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Contact requests & friendship verification</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Temporary, ephemeral WebRTC signaling (offers/answers)</span>
                </li>
              </ul>
            </div>

            {/* What the Server NEVER Does */}
            <div className="bg-slate-950/80 border border-red-950/50 rounded-2xl p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Strictly Prohibited on Server</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-900/50">ZERO Storage</span>
              </div>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <ServerOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span><strong>NO chat message tables</strong> in the database</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <ServerOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span><strong>NO file or media storage</strong> buckets</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <ServerOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span><strong>NO TURN relay servers</strong> (Only direct STUN)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <ServerOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span><strong>NO Gmail discovery</strong> (Email is never public)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Direct P2P Flow Diagram */}
          <div className="mt-8 p-6 bg-slate-950/90 rounded-2xl border border-slate-800 text-center">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl w-full sm:w-48">
                <div className="w-10 h-10 rounded-full bg-cyan-950 border border-cyan-800 flex items-center justify-center mx-auto mb-2 text-cyan-300 font-bold">A</div>
                <p className="text-xs font-bold text-white">Browser Client A</p>
                <p className="text-[11px] text-slate-400 mt-1">IndexedDB Local Storage</p>
              </div>

              <div className="flex-1 flex flex-col items-center">
                <div className="h-0.5 w-full bg-gradient-to-r from-cyan-500 via-sky-400 to-cyan-500 relative flex items-center justify-center">
                  <span className="bg-slate-950 px-3 py-1 rounded-full text-[11px] font-mono text-cyan-300 border border-cyan-800">
                    Direct WebRTC RTCDataChannel + MediaStream (AES-256-GCM)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 mt-2">Zero Server Intermediary</span>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl w-full sm:w-48">
                <div className="w-10 h-10 rounded-full bg-sky-950 border border-sky-800 flex items-center justify-center mx-auto mb-2 text-sky-300 font-bold">B</div>
                <p className="text-xs font-bold text-white">Browser Client B</p>
                <p className="text-[11px] text-slate-400 mt-1">IndexedDB Local Storage</p>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left mb-16">
          <div className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <Lock className="w-8 h-8 text-cyan-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Application-Level E2EE</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Every message and binary chunk is encrypted with AES-256-GCM using keys derived via client-side ECDH P-256. Private keys never leave your device.
            </p>
          </div>

          <div className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <QrCode className="w-8 h-8 text-sky-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Permanent QR Codes</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Connect via permanent account QR codes or unique public IDs. Your email address is never disclosed or searchable.
            </p>
          </div>

          <div className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <HardDrive className="w-8 h-8 text-emerald-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Device-Only Storage</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Conversation history is preserved strictly in your browser's IndexedDB. You can inspect, delete, or clear conversations at any time.
            </p>
          </div>
        </section>

        {/* Network & TURN Transparency Alert */}
        <div className="w-full bg-amber-950/30 border border-amber-900/50 rounded-2xl p-5 text-left flex items-start gap-4 mb-12">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-200">Honest Network Connectivity Transparency</h4>
            <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
              To guarantee zero cloud relaying, TURN servers are intentionally not configured. If two peers are behind restrictive corporate firewalls or symmetric NATs that prevent direct STUN connectivity, the app reports that a direct connection could not be established rather than silently routing your data through a third-party relay.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-6 text-center text-xs text-slate-500">
        <p>P2P Shield Chat • Open, Private, Direct Browser Communication • Built with React, WebRTC, IndexedDB & Supabase</p>
      </footer>
    </div>
  );
};
