import React, { useState, useEffect } from 'react';
import { X, Lock, KeyRound, ShieldAlert, Check, ShieldCheck } from 'lucide-react';
import { securityService } from '@/services/security';
import type { AppSecuritySettings } from '@/types';

interface SecuritySettingsModalProps {
  onClose: () => void;
}

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<AppSecuritySettings | null>(null);
  const [pin, setPin] = useState('');
  const [decoyPin, setDecoyPin] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await securityService.getSettings();
    setSettings(s);
  };

  const handleSavePin = async () => {
    if (pin.length < 4) {
      setErrorMsg('PIN must be at least 4 digits');
      return;
    }
    if (decoyPin && decoyPin === pin) {
      setErrorMsg('Decoy PIN must be different from primary PIN');
      return;
    }

    try {
      await securityService.setPin(pin, decoyPin || undefined);
      setSuccessMsg('Security PIN updated successfully');
      setPin('');
      setDecoyPin('');
      await loadSettings();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRemovePin = async () => {
    await securityService.removePin();
    await loadSettings();
    setSuccessMsg('PIN protection disabled');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/90 backdrop-blur-2xl p-4 animate-fade-in select-none">
      <div className="w-full max-w-md bg-obsidian-900 border border-white/10 rounded-3xl shadow-2xl p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-semibold text-white">App Lock & Stealth Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* PIN Configuration */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-medium text-slate-300">
            {settings?.hasPin ? 'Change Master PIN (4-6 digits)' : 'Set Master PIN (4-6 digits)'}
          </label>
          <input
            type="password"
            maxLength={6}
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-obsidian-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono tracking-widest"
          />

          {/* Decoy PIN Configuration */}
          <div className="mt-2">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <span>Decoy PIN (Plausible Deniability)</span>
              <span className="text-[10px] text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">Optional</span>
            </label>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-2">
              If coerced to open the app, entering this decoy PIN unlocks an empty dummy state with zero contacts or messages.
            </p>
            <input
              type="password"
              maxLength={6}
              placeholder="••••"
              value={decoyPin}
              onChange={(e) => setDecoyPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-obsidian-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono tracking-widest"
            />
          </div>

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleSavePin}
              disabled={pin.length < 4}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-sky-400 text-slate-950 font-bold text-xs disabled:opacity-30 hover:opacity-95 transition-all cursor-pointer shadow-md shadow-cyan-500/20"
            >
              Save PIN
            </button>
            {settings?.hasPin && (
              <button
                onClick={handleRemovePin}
                className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 font-medium text-xs transition-all cursor-pointer"
              >
                Remove PIN
              </button>
            )}
          </div>
        </div>

        {/* Emergency Panic Wipe Section */}
        <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-rose-300">Nuclear Panic Wipe</div>
            <div className="text-[11px] text-slate-400">Instantly delete all local keys and messages</div>
          </div>
          <button
            onClick={() => securityService.panicWipe()}
            className="px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
          >
            Wipe Everything
          </button>
        </div>
      </div>
    </div>
  );
};
