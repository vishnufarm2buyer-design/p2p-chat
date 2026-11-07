import React from 'react';
import { X, ShieldCheck, CheckCircle2, ServerOff, Lock, HardDrive, AlertTriangle } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Privacy Transparency Architecture</h3>
              <p className="text-xs text-slate-400">"The server connects people; their devices communicate."</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Handled by Server */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-sky-900/40">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider block mb-3">
                What the Server Handles:
              </span>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Google account authentication & secure session persistence</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Public identity information (Display name & Permanent ID)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Contact relationships & requests</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Real-time online/offline presence tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Temporary, ephemeral WebRTC signaling (offers, answers, ICE)</span>
                </li>
              </ul>
            </div>

            {/* Strictly NOT Handled by Server */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-red-950/60">
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider block mb-3">
                What the Server NEVER Touches:
              </span>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <ServerOff className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <span><strong>Zero chat message storage:</strong> No messages table exists.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ServerOff className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <span><strong>Zero media storage:</strong> No cloud file buckets exist.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ServerOff className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <span><strong>Zero relays:</strong> No TURN servers or SFU media servers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ServerOff className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <span><strong>Zero private keys:</strong> Cryptographic keys stay on device.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ServerOff className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <span><strong>Zero Gmail discovery:</strong> Email is never made public.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Detailed Explanations */}
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-1.5">
                <Lock className="w-4 h-4 text-cyan-400" />
                Application-Level E2EE (AES-256-GCM)
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                In addition to standard WebRTC DTLS/SRTP transport encryption, P2P Shield Chat derives a shared symmetric key directly between peers using W3C Web Cryptography API (ECDH P-256). Every text packet and file chunk transmitted across the RTCDataChannel is encrypted with AES-256-GCM with a fresh random 12-byte initialization vector.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-1.5">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                Local-Only Conversation History (IndexedDB)
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Conversation history exists solely in your browser's local IndexedDB. Because the server does not store offline messages, both you and your contact must have the app open and online to establish a direct connection and exchange messages.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-900/50">
              <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Why We Strictly Prohibit TURN Servers
              </h4>
              <p className="text-xs text-amber-200/80 leading-relaxed">
                TURN servers act as intermediate relay proxies when direct NAT traversal fails. While TURN increases connection success rates on restrictive enterprise firewalls, it introduces an intermediary server that proxies all your traffic. In strict adherence to our privacy principles, we use STUN exclusively for NAT discovery. If network restrictions prevent a direct connection, the app informs you rather than silently relaying your data.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end shrink-0 bg-slate-950">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
