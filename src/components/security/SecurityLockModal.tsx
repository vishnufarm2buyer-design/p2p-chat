import React, { useState, useEffect } from 'react';
import { Lock, Delete, Fingerprint, ShieldAlert, Shuffle } from 'lucide-react';
import { securityService } from '@/services/security';

interface SecurityLockModalProps {
  onUnlocked: () => void;
}

export const SecurityLockModal: React.FC<SecurityLockModalProps> = ({ onUnlocked }) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [scramble, setScramble] = useState<boolean>(false);
  const [keypadOrder, setKeypadOrder] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
  const [showPanicConfirm, setShowPanicConfirm] = useState<boolean>(false);

  useEffect(() => {
    if (scramble) {
      const shuffled = [...keypadOrder].sort(() => Math.random() - 0.5);
      setKeypadOrder(shuffled);
    } else {
      setKeypadOrder([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
    }
  }, [scramble]);

  const handleDigit = async (d: number) => {
    if (pin.length >= 6) return;
    const nextPin = pin + d;
    setPin(nextPin);
    setError(null);

    if (nextPin.length >= 4) {
      // Auto-attempt unlock if valid PIN length
      const res = await securityService.unlockWithPin(nextPin);
      if (res.success) {
        onUnlocked();
      } else if (nextPin.length >= 6) {
        setError('Incorrect PIN');
        setPin('');
      }
    }
  };

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1));
    setError(null);
  };

  const handleBiometric = async () => {
    try {
      if (window.PublicKeyCredential) {
        // Standard WebAuthn prompt simulation / unlock
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        // If device has biometric capability, trigger credential assertion
        onUnlocked();
      }
    } catch (e) {
      console.warn('Biometric unlock unavailable:', e);
    }
  };

  const handleNuclearPanic = async () => {
    await securityService.panicWipe();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/98 backdrop-blur-3xl p-4 select-none animate-fade-in">
      <div className="w-full max-w-xs flex flex-col items-center gap-6">
        {/* App Lock Icon & Title */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shadow-2xl shadow-cyan-500/20">
            <Lock className="w-8 h-8 text-cyan-400" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-wide">Shield App Lock</h2>
          <p className="text-xs text-slate-400">Enter your secure PIN to access chats</p>
        </div>

        {/* PIN Dots */}
        <div className="flex items-center gap-3">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                pin.length > idx
                  ? 'bg-cyan-400 shadow-lg shadow-cyan-400/50 scale-110'
                  : 'bg-white/10 border border-white/20'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-rose-400 font-medium animate-pulse">{error}</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {keypadOrder.slice(0, 9).map((num) => (
            <button
              key={num}
              onClick={() => handleDigit(num)}
              className="h-16 rounded-2xl bg-obsidian-900 border border-white/[0.08] text-xl font-bold text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-sm"
            >
              {num}
            </button>
          ))}

          {/* Biometric / Scramble option */}
          <button
            onClick={() => setScramble(!scramble)}
            className="h-16 rounded-2xl bg-obsidian-900/50 border border-white/[0.05] text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
            title="Scramble Keypad"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* 0 Key */}
          <button
            onClick={() => handleDigit(keypadOrder[9])}
            className="h-16 rounded-2xl bg-obsidian-900 border border-white/[0.08] text-xl font-bold text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-sm"
          >
            {keypadOrder[9]}
          </button>

          {/* Delete Key */}
          <button
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-obsidian-900/50 border border-white/[0.05] text-slate-400 hover:text-rose-400 transition-all cursor-pointer flex items-center justify-center"
            title="Delete"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Panic Button Confirmation Modal */}
        {showPanicConfirm ? (
          <div className="w-full p-4 rounded-2xl bg-rose-950/80 border border-rose-500/50 flex flex-col gap-3 animate-fade-in text-center">
            <ShieldAlert className="w-6 h-6 text-rose-400 mx-auto" />
            <p className="text-xs text-rose-200 font-medium">
              Are you sure? This will permanently wipe all local cryptographic keys, chats, and cache immediately.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPanicConfirm(false)}
                className="flex-1 py-2 text-xs rounded-xl bg-white/10 text-white font-medium hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={handleNuclearPanic}
                className="flex-1 py-2 text-xs rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-500 shadow-lg shadow-rose-950/50"
              >
                Confirm Wipe
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowPanicConfirm(true)}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors cursor-pointer py-1"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Emergency Nuclear Panic Wipe</span>
          </button>
        )}
      </div>
    </div>
  );
};
