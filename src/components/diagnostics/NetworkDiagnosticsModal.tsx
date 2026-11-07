import React, { useState, useEffect } from 'react';
import { 
  X, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  RefreshCw,
  Server
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

    try {
      const config = createStunOnlyRtcConfiguration();
      const pc = new RTCPeerConnection(config);

      // Create a dummy data channel to trigger ICE candidate gathering
      pc.createDataChannel('diag-test');

      const foundCandidates: IceCandidateSummary[] = [];

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const cand = event.candidate;
          const type = cand.type || 'unknown';

          if (type === 'relay') {
            setHasRelayCandidate(true);
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
          // Gathering complete
          setTesting(false);
          pc.close();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Timeout after 6 seconds if gathering takes long
      setTimeout(() => {
        setTesting(false);
        try { pc.close(); } catch (_) {}
      }, 6000);

    } catch (err) {
      console.error('Diagnostic error:', err);
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Network & STUN Diagnostics</h3>
              <p className="text-xs text-slate-400">Live WebRTC ICE candidate inspection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Diagnostic Checks Status Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                STUN NAT Discovery
              </span>
              <div className="flex items-center gap-1.5 font-bold text-sm">
                {testing ? (
                  <span className="text-amber-400 animate-pulse">Gathering...</span>
                ) : stunPassed ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Operational
                  </span>
                ) : (
                  <span className="text-slate-400">Host Candidates Only</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Zero-Relay Verification
              </span>
              <div className="flex items-center gap-1.5 font-bold text-sm">
                {!hasRelayCandidate ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" /> Verified (No TURN)
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Relay Detected
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Configured STUN Servers */}
          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                Configured STUN Servers:
              </span>
              <span className="text-[10px] text-cyan-400">Public NAT Resolvers</span>
            </div>
            <ul className="space-y-1 font-mono text-[11px] text-slate-400">
              {DEFAULT_STUN_SERVERS.slice(0, 3).map((srv) => (
                <li key={srv} className="bg-slate-950 px-2 py-1 rounded border border-slate-850">
                  {srv}
                </li>
              ))}
            </ul>
          </div>

          {/* Discovered ICE Candidates */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-300">
                Discovered ICE Candidates ({candidates.length}):
              </span>
              <button
                onClick={runStunDiagnostics}
                disabled={testing}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
                Re-run Test
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/60 border border-slate-800 rounded-xl bg-slate-950 p-1">
              {candidates.length === 0 ? (
                <p className="p-3 text-center text-slate-500">
                  {testing ? 'Probing STUN servers...' : 'No candidates gathered.'}
                </p>
              ) : (
                candidates.map((cand, idx) => (
                  <div key={idx} className="p-2 flex items-center justify-between font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          cand.type === 'srflx'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                            : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {cand.type}
                      </span>
                      <span className="text-slate-300">{cand.protocol.toUpperCase()}</span>
                    </div>
                    <span className="text-slate-400 truncate max-w-[150px]">
                      {cand.address}:{cand.port}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            <code>srflx</code> (server-reflexive) candidates demonstrate that STUN is successfully resolving your external NAT address for direct peer connections. Because <code>relay</code> candidates are omitted by design, communication is guaranteed to be direct without third-party proxies.
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end shrink-0 bg-slate-950">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
