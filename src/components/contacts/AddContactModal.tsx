import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Search, 
  Camera, 
  Upload, 
  UserPlus, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { supabaseService } from '@/services/supabase';
import { qrService } from '@/services/qr';
import type { UserProfile } from '@/types';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddContactModal: React.FC<AddContactModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const { sendContactRequestByPublicId } = useChat();

  const [activeTab, setActiveTab] = useState<'id' | 'scan'>('id');
  const [publicIdInput, setPublicIdInput] = useState('');
  const [previewProfile, setPreviewProfile] = useState<UserProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // QR Scanner refs
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader-container';

  // Clear state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setPublicIdInput('');
      setPreviewProfile(null);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  // Clean up scanner when switching tabs
  useEffect(() => {
    if (activeTab === 'scan') {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [activeTab]);

  const startScanner = async () => {
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false
        });
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleQrDecoded(decodedText);
        },
        () => {}
      );
    } catch (err: any) {
      console.warn('Camera scanner start error:', err);
      setErrorMsg('Camera access was not granted or is unavailable. You can upload a QR image or enter the ID manually.');
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().then(() => {
            scannerRef.current?.clear();
          }).catch(console.warn);
        }
      } catch (_) {}
    }
  };

  const handleQrDecoded = (decodedText: string) => {
    const extractedId = qrService.parseQrContent(decodedText);
    if (extractedId) {
      stopScanner();
      setActiveTab('id');
      setPublicIdInput(extractedId);
      lookupPublicId(extractedId);
    } else {
      setErrorMsg('Scanned QR code does not contain a valid P2P Shield Chat identity.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    try {
      const html5QrCode = new Html5Qrcode('qr-temp-file-reader');
      const decodedText = await html5QrCode.scanFile(file, true);
      handleQrDecoded(decodedText);
    } catch (err) {
      setErrorMsg('Could not read a valid QR code from this image. Please try another image.');
    }
  };

  const lookupPublicId = async (idToSearch: string) => {
    const trimmed = idToSearch.trim();
    if (!trimmed) return;

    if (trimmed === currentUser?.public_id) {
      setErrorMsg('This is your own public ID. You cannot add yourself as a contact.');
      setPreviewProfile(null);
      return;
    }

    setIsSearching(true);
    setErrorMsg(null);
    setPreviewProfile(null);

    try {
      const profile = await supabaseService.getProfileByPublicId(trimmed);
      if (profile) {
        setPreviewProfile(profile);
      } else {
        setErrorMsg(`No user found with public ID "${trimmed}". Check the ID and try again.`);
      }
    } catch (err: any) {
      setErrorMsg('Lookup error: ' + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!previewProfile) return;

    setIsSending(true);
    setErrorMsg(null);

    try {
      const res = await sendContactRequestByPublicId(previewProfile.public_id);
      if (res.success) {
        setSuccessMsg(`Contact request sent to ${previewProfile.display_name}!`);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMsg(res.error || 'Failed to send contact request.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Add New Contact</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-2 bg-slate-900/60 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('id')}
            className={`py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'id'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Enter Public ID
          </button>
          <button
            onClick={() => setActiveTab('scan')}
            className={`py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'scan'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Scan Permanent QR
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-900/60 text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-900/60 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'id' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Permanent Public User ID
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={publicIdInput}
                      onChange={(e) => setPublicIdInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && lookupPublicId(publicIdInput)}
                      placeholder="e.g. p2p_a1b2c3d4e5"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <button
                    onClick={() => lookupPublicId(publicIdInput)}
                    disabled={isSearching || !publicIdInput.trim()}
                    className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Lookup
                  </button>
                </div>
              </div>

              {/* Profile Preview Card */}
              {previewProfile && (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center font-bold text-slate-950 text-base">
                      {previewProfile.display_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{previewProfile.display_name}</h4>
                      <p className="text-xs font-mono text-cyan-400">{previewProfile.public_id}</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Direct P2P communication can begin as soon as this user accepts your request.
                  </p>

                  <button
                    onClick={handleSendRequest}
                    disabled={isSending}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Send Contact Request
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div
                id={scannerContainerId}
                className="w-full aspect-square rounded-2xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center"
              />

              <div id="qr-temp-file-reader" className="hidden" />

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Or upload an image containing a QR code:</span>
                <label className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Image
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
