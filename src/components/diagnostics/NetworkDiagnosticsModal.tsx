import React, { useState, useEffect } from 'react';
import { 
  X, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  RefreshCw,
  Server,
  Zap,
  Globe
} from 'lucide-react';
import { createStunOnlyRtcConfiguration, DEFAULT_STUN_SERVERS } from '@/services/webrtc/stunConfig';

interface NetworkDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface IceCandidateSummary {
  type: string;
  protocol: string;
  address: string;
  port: number;
}

export const NetworkDiagnosticsModal: React.FC<NetworkDiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const [testing, setTesting] = useState(false);
  const [candidates, setCandidates] = useState<IceCandidateSummary[]>([]);
  const [stunPassed, setStunPassed] = useState<boolean | null>(null);
  const [hasRelayCandidate, setHasRelayCandidate] = useState(false);
  const [hasHostCandidate, setHasHostCandidate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      runStunDiagnostics();
    }
  }, [isOpen]);

  const runStunDiagnostics = async () => {
    setTesting(true);
    setCandidates([]);
    setStunPassed(null);
    setHasRelayCandidate(false);
    setHasHostCandidate(false);

    try {
      const config = createStunOnlyRtcConfiguration();
      const pc = new RTCPeerConnection(config);

      pc.createDataChannel('diag-test');

      const foundCandidates: IceCandidateSummary[] = [];

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const cand = event.candidate;
          const type = cand.type || 'unknown';

          if (type === 'relay') {
            setHasRelayCandidate(true);
          }
          if (type === 'host') {
            setHasHostCandidate(true);
          }

          foundCandidates.push({
            type,
            protocol: cand.protocol || 'udp',
            address: cand.address || cand.relatedAddress || 'masked',
            port: cand.port || 0
          });

          setCandidates([...foundCandidates]);

          if (type === 'srflx') {
            setStunPassed(true);
          }
        } else {
          setTesting(false);
          pc.close();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setTimeout(() => {
        setTesting(false);
        try { pc.close(); } catch (_) {}
      }, 5000);

    } catch (err) {
      console.error('Diagnostic error:', err);
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-obsidian-900 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Network &amp; STUN Diagnostics</h3>
              <p className="text-xs text-slate-400">Real-time WebRTC NAT Traversal &amp; STUN Diagnostics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300">
          {/* Status Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                STUN Public Traversal
              </span>
              <div className="flex items-center gap-1.5 font-bold text-sm">
                {testing ? (
                  <span className="text-amber-400 animate-pulse">Probing STUN...</span>
                ) : stunPassed ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Operational
                  </span>
                ) : (
                  <span className="text-slate-400">Host Gathered</span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Zero-Relay Verification
              </span>
              <div className="flex items-center gap-1.5 font-bold text-sm">
                {!hasRelayCandidate ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" /> Verified (No TURN)
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Relay Detected
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Direct STUN P2P Traversal Notice */}
          <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-start gap-3">
            <Globe className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-cyan-300">Direct STUN P2P Traversal</p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                STUN servers discover public reflexive endpoints across NAT and firewalls to establish direct, end-to-end encrypted peer-to-peer connections with zero intermediary servers or cloud message storage.
              </p>
            </div>
          </div>

          {/* Configured STUN Servers */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                Configured STUN Servers:
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">STUN-Only</span>
            </div>
            <ul className="space-y-1.5 font-mono text-[11px] text-slate-400">
              {DEFAULT_STUN_SERVERS.slice(0, 3).map((srv) => (
                <li key={srv} className="bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/[0.04]">
                  {srv}
                </li>
              ))}
            </ul>
          </div>

          {/* Discovered ICE Candidates */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-200">
                Discovered ICE Candidates ({candidates.length}):
              </span>
              <button
                onClick={runStunDiagnostics}
                disabled={testing}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
                Re-run Test
              </button>
            </div>

            <div className="max-h-44 overflow-y-auto divide-y divide-white/[0.04] border border-white/[0.08] rounded-2xl bg-white/[0.02] p-1.5">
              {candidates.length === 0 ? (
                <p className="p-4 text-center text-slate-500">
                  {testing ? 'Probing STUN servers...' : 'No candidates gathered.'}
                </p>
              ) : (
                candidates.map((cand, idx) => (
                  <div key={idx} className="p-2 flex items-center justify-between font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          cand.type === 'srflx'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : cand.type === 'host'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-white/[0.06] text-slate-400'
                        }`}
                      >
                        {cand.type}
                      </span>
                      <span className="text-slate-300">{cand.protocol.toUpperCase()}</span>
                    </div>
                    <span className="text-slate-400 truncate max-w-[170px]">
                      {cand.address}:{cand.port}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] flex justify-end shrink-0 bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-semibold rounded-2xl transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
