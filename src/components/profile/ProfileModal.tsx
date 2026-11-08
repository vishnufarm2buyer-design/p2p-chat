import React, { useState, useEffect } from 'react';
import { 
  X, 
  QrCode, 
  Copy, 
  Check, 
  Download, 
  Share2, 
  Camera, 
  Trash2, 
  HardDrive, 
  ShieldCheck, 
  Edit2,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { qrService } from '@/services/qr';
import { localDb } from '@/services/db';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateDisplayName, updateLocalAvatar, signOut } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [storageWiped, setStorageWiped] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.display_name);

      // Generate permanent QR code
      qrService.generateQrDataUrl(currentUser.public_id).then(setQrDataUrl);
    }
  }, [currentUser]);

  if (!isOpen || !currentUser) return null;

  const handleCopyPublicId = () => {
    navigator.clipboard.writeText(currentUser.public_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (qrDataUrl) {
      qrService.downloadQrCode(qrDataUrl, currentUser.public_id);
    }
  };

  const handleShareQr = async () => {
    const uri = qrService.getPermanentUri(currentUser.public_id);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Connect with me on P2P Shield Chat',
          text: `Add my permanent URI: ${uri}`,
          url: window.location.origin + `?contact=${currentUser.public_id}`
        });
      } catch (_) {}
    } else {
      handleCopyPublicId();
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        await updateLocalAvatar(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveDisplayName = async () => {
    const trimmed = displayName.trim();
    if (trimmed && trimmed !== currentUser.display_name) {
      await updateDisplayName(trimmed);
    }
    setIsEditingName(false);
  };

  const handleWipeLocalStorage = async () => {
    if (confirm('Are you sure you want to delete all local conversation history and cached peer data from this device?')) {
      await localDb.wipeAllLocalData();
      setStorageWiped(true);
      setTimeout(() => setStorageWiped(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-md bg-slate-950/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] backdrop-blur-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Permanent Cryptographic Identity</h3>
              <p className="text-[10px] text-slate-400">Device-bound E2EE key agreement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/[0.06] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {storageWiped && (
            <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>All local chat history and cached peer data has been wiped.</span>
            </div>
          )}

          {/* Avatar & Display Name */}
          <div className="flex flex-col items-center text-center">
            <div className="relative group mb-3">
              <div className="w-22 h-22 rounded-3xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-indigo-600 flex items-center justify-center font-bold text-slate-950 text-2xl shadow-xl overflow-hidden ring-4 ring-white/5">
                {currentUser.avatar_data ? (
                  <img src={currentUser.avatar_data} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  currentUser.display_name.substring(0, 2).toUpperCase()
                )}
              </div>
              <label className="absolute inset-0 rounded-3xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white backdrop-blur-xs">
                <Camera className="w-6 h-6" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            </div>

            {/* Editable Name */}
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="px-3 py-1 bg-slate-900 border border-cyan-500 rounded-xl text-sm text-white focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveDisplayName}
                  className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-white">{currentUser.display_name}</h4>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                  title="Edit Display Name"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Your avatar is stored strictly on device and shared peer-to-peer (never on cloud).
            </p>
          </div>

          {/* Permanent Public ID */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Permanent Public ID
              </span>
              <span className="text-[10px] text-cyan-400 font-medium">Never Changes</span>
            </div>
            <div className="flex items-center justify-between bg-slate-900/90 px-3.5 py-2.5 rounded-xl border border-white/[0.08]">
              <span className="font-mono text-xs sm:text-sm text-cyan-300 select-all font-bold truncate mr-2">
                {currentUser.public_id}
              </span>
              <button
                onClick={handleCopyPublicId}
                className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Copy Public ID"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Share this ID with friends so they can add you directly.
            </p>
          </div>

          {/* Permanent QR Code */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col items-center text-center space-y-3">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-cyan-400" />
                Permanent Identity QR Code
              </span>
              <span className="text-[10px] text-slate-400">p2pchat://user/...</span>
            </div>

            {/* QR Image Box */}
            <div className="p-3 bg-white rounded-2xl shadow-xl">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Permanent Identity QR Code" className="w-44 h-44 rounded-lg" />
              ) : (
                <div className="w-44 h-44 bg-slate-900 animate-pulse rounded-lg flex items-center justify-center text-slate-600 text-xs">
                  Generating QR...
                </div>
              )}
            </div>

            {/* QR Download & Share buttons */}
            <div className="flex items-center gap-2 w-full pt-1">
              <button
                onClick={handleDownloadQr}
                className="flex-1 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs font-bold rounded-xl border border-white/[0.08] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download PNG
              </button>
              <button
                onClick={handleShareQr}
                className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share Link
              </button>
            </div>
          </div>

          {/* Local Device Storage Controls */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-amber-400" />
                Local Storage (IndexedDB)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Conversations are stored only inside your browser database. No chat backup exists in the cloud.
            </p>
            <button
              onClick={handleWipeLocalStorage}
              className="w-full py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-semibold rounded-xl border border-red-900/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Wipe All Local History & Data
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] flex items-center justify-between shrink-0 bg-slate-950/80">
          <button
            onClick={() => {
              signOut();
              onClose();
            }}
            className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
