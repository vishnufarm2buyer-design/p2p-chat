import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, ServerOff, Lock, HardDrive, AlertTriangle, Ban, UserCheck } from 'lucide-react';
import { useChat } from '@/context/ChatContext';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  const { blockedUsers, unblockContact } = useChat();
  const [activeTab, setActiveTab] = useState<'architecture' | 'blocked'>('architecture');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-2xl bg-slate-950/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] backdrop-blur-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Privacy & Security Architecture</h3>
              <p className="text-[10px] text-slate-400">"The server connects people; their devices communicate."</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/[0.06] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 flex gap-4 border-b border-white/[0.06] bg-slate-950/80">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'architecture'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Privacy Architecture
          </button>
          <button
            onClick={() => setActiveTab('blocked')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'blocked'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            Blocked Contacts ({blockedUsers.length})
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {activeTab === 'blocked' ? (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                  <Ban className="w-4 h-4 text-red-400" />
                  Locally Blocked Peers
                </h4>
                <p className="text-xs text-slate-400">
                  Blocked users cannot send you WebRTC signaling requests, messages, files, or call invitations. All packets from these IDs are immediately dropped on your device.
                </p>
              </div>

              {blockedUsers.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <UserCheck className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                  <p className="text-xs font-medium text-slate-400">No contacts currently blocked</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    You can block a contact from their chat options menu.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                  {blockedUsers.map((userId) => (
                    <div key={userId} className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-red-950/80 border border-red-800/60 flex items-center justify-center text-red-400 text-xs font-bold">
                          <Ban className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-mono text-slate-200">{userId}</p>
                          <span className="text-[10px] text-red-400">Blocked</span>
                        </div>
                      </div>
                      <button
                        onClick={() => unblockContact(userId)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
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
            </>
          )}
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
