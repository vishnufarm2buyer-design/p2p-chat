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
  CheckCircle2
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">My Profile & Permanent Identity</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {storageWiped && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-900/60 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>All local chat history and cached peer data has been wiped.</span>
            </div>
          )}

          {/* Avatar & Display Name */}
          <div className="flex flex-col items-center text-center">
            <div className="relative group mb-3">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center font-bold text-slate-950 text-2xl shadow-xl overflow-hidden">
                {currentUser.avatar_data ? (
                  <img src={currentUser.avatar_data} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  currentUser.display_name.substring(0, 2).toUpperCase()
                )}
              </div>
              <label className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white">
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
                  className="px-2.5 py-1 bg-slate-900 border border-cyan-500 rounded-lg text-sm text-white focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveDisplayName}
                  className="px-2.5 py-1 bg-cyan-500 text-slate-950 rounded-lg text-xs font-bold cursor-pointer"
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
              Avatar is stored on device and transferred peer-to-peer (never on cloud).
            </p>
          </div>

          {/* Permanent Public ID */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Permanent Public ID
              </span>
              <span className="text-[10px] text-cyan-400">Never Changes</span>
            </div>
            <div className="flex items-center justify-between bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
              <span className="font-mono text-sm text-cyan-300 select-all font-semibold">
                {currentUser.public_id}
              </span>
              <button
                onClick={handleCopyPublicId}
                className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Copy Public ID"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Share this ID with peers so they can send you contact requests.
            </p>
          </div>

          {/* Permanent QR Code */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center text-center space-y-3">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-cyan-400" />
                Permanent Identity QR Code
              </span>
              <span className="text-[10px] text-slate-400">Format: p2pchat://user/...</span>
            </div>

            {/* QR Image Box */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-cyan-800/60 shadow-lg">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Permanent Identity QR Code" className="w-48 h-48 rounded-lg" />
              ) : (
                <div className="w-48 h-48 bg-slate-900 animate-pulse rounded-lg flex items-center justify-center text-slate-600">
                  Generating QR...
                </div>
              )}
            </div>

            {/* QR Download & Share buttons */}
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={handleDownloadQr}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download QR
              </button>
              <button
                onClick={handleShareQr}
                className="flex-1 py-2 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 text-xs font-semibold rounded-xl border border-cyan-800/80 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share Link
              </button>
            </div>
          </div>

          {/* Local Device Storage Controls */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-amber-400" />
                Local Device Storage (IndexedDB)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Your conversations are stored only inside this browser on this device. No chat backup exists in the cloud.
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
        <div className="p-4 border-t border-slate-800 flex items-center justify-between shrink-0 bg-slate-950">
          <button
            onClick={() => {
              signOut();
              onClose();
            }}
            className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors cursor-pointer"
          >
            Sign Out of Account
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
