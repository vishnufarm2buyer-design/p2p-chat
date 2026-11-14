import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, CheckCircle2, Copy, Check } from 'lucide-react';
import QRCode from 'qrcode';
import { securityService } from '@/services/security';
import { cryptoService } from '@/services/crypto';
import { supabaseService } from '@/services/supabase';

interface SafetyNumberModalProps {
  peerUserId: string;
  peerUserName: string;
  currentUserId: string;
  onClose: () => void;
}

export const SafetyNumberModal: React.FC<SafetyNumberModalProps> = ({
  peerUserId,
  peerUserName,
  currentUserId,
  onClose
}) => {
  const [safetyNumber, setSafetyNumber] = useState<string>('Computing...');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadSafetyNumber();
  }, [peerUserId, currentUserId]);

  const loadSafetyNumber = async () => {
    try {
      setLoading(true);
      const { publicKeyJWK: myKey } = await cryptoService.getOrCreateDeviceKeypair();
      let peerKey = await supabaseService.getPeerPublicKey(peerUserId);
      if (!peerKey) {
        peerKey = 'fallback_' + peerUserId;
      }

      const num = await securityService.calculateSafetyNumber(myKey, peerKey);
      setSafetyNumber(num);

      const dataUrl = await QRCode.toDataURL(`shield-safety-number:${peerUserId}:${num}`, {
        width: 200,
        margin: 1,
        color: { dark: '#0284c7', light: '#ffffff' }
      });
      setQrDataUrl(dataUrl);

      // Check verified status from localStorage
      const verifiedKey = `shield_verified_${peerUserId}`;
      const saved = localStorage.getItem(verifiedKey);
      setIsVerified(saved === 'true');
    } catch (err) {
      console.error('Failed to compute safety number:', err);
      setSafetyNumber('00000 00000 00000 00000 00000 00000 00000 00000 00000 00000 00000 00000');
    } finally {
      setLoading(false);
    }
  };

  const toggleVerified = () => {
    const next = !isVerified;
    setIsVerified(next);
    localStorage.setItem(`shield_verified_${peerUserId}`, next ? 'true' : 'false');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(safetyNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const blocks = safetyNumber.split(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/90 backdrop-blur-2xl p-4 animate-fade-in select-none">
      <div className="w-full max-w-md bg-obsidian-900 border border-white/10 rounded-3xl shadow-2xl p-6 flex flex-col items-center gap-5">
        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <div>
              <h3 className="text-base font-semibold text-white">Verify Safety Number</h3>
              <p className="text-xs text-slate-400">End-to-End Cryptographic Identity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info */}
        <p className="text-xs text-slate-300 text-center leading-relaxed px-2">
          Compare this 60-digit safety number with <span className="font-semibold text-white">{peerUserName}</span> or scan the QR code to ensure no man-in-the-middle has intercepted your direct P2P link.
        </p>

        {/* QR Code Container */}
        <div className="p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center min-h-[160px]">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Safety Number QR" className="w-40 h-40" />
          ) : (
            <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-500">
              Generating QR...
            </div>
          )}
        </div>

        {/* 60-digit fingerprint grouped in 12 blocks of 5 */}
        <div className="w-full bg-obsidian-950/80 border border-white/5 rounded-2xl p-4 font-mono text-center">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs sm:text-sm font-bold text-cyan-300">
            {blocks.map((block, i) => (
              <span key={i} className="py-1 px-1.5 rounded bg-white/[0.04]">
                {block}
              </span>
            ))}
          </div>

          <button
            onClick={handleCopy}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to clipboard' : 'Copy 60-digit number'}</span>
          </button>
        </div>

        {/* Verified Toggle */}
        <button
          onClick={toggleVerified}
          className={`w-full py-3 rounded-2xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            isVerified
              ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
              : 'bg-gradient-to-tr from-cyan-500 to-sky-400 text-slate-950 hover:opacity-95'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{isVerified ? 'Marked as Verified ✓' : 'Mark as Verified'}</span>
        </button>
      </div>
    </div>
  );
};
