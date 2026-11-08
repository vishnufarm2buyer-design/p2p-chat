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
  Loader2,
  Ban,
  Check,
  MessageSquare
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
  const { 
    sendContactRequestByPublicId, 
    contacts, 
    contactRequests, 
    selectDirectChat, 
    blockedUsers, 
    unblockContact, 
    acceptRequest 
  } = useChat();

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
        if (res.autoAccepted || res.alreadyContact) {
          setSuccessMsg(`Connected with ${previewProfile.display_name}! Opening chat...`);
          setTimeout(() => {
            const existing = contacts.find(c => c.contact_id === previewProfile.id) || {
              id: 'c_' + previewProfile.id,
              user_id: currentUser!.id,
              contact_id: previewProfile.id,
              created_at: new Date().toISOString(),
              profile: previewProfile,
              presence: 'offline',
              connectionStatus: 'idle'
            };
            selectDirectChat(existing as any);
            onClose();
          }, 600);
        } else {
          setSuccessMsg(res.message || `Contact request sent to ${previewProfile.display_name}!`);
          setTimeout(() => {
            onClose();
          }, 1500);
        }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-md bg-slate-950/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-2xl">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Add New Contact</h3>
              <p className="text-[10px] text-slate-400">Search by public ID or scan QR</p>
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
        <div className="p-2.5 bg-slate-900/60 border-b border-white/[0.06]">
          <div className="grid grid-cols-2 p-1 bg-slate-900/90 rounded-2xl border border-white/[0.06] text-xs">
            <button
              onClick={() => setActiveTab('id')}
              className={`py-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'id'
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Enter Public ID
            </button>
            <button
              onClick={() => setActiveTab('scan')}
              className={`py-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'scan'
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Scan Permanent QR
            </button>
          </div>
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
              {previewProfile && (() => {
                const isBlocked = blockedUsers.includes(previewProfile.id);
                const existingContact = contacts.find(
                  c => c.contact_id === previewProfile.id || c.profile.public_id === previewProfile.public_id
                );
                const incomingReq = contactRequests.incoming.find(
                  r => r.sender_id === previewProfile.id
                );
                const outgoingReq = contactRequests.outgoing.find(
                  r => r.receiver_id === previewProfile.id
                );

                return (
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center font-bold text-slate-950 text-base">
                        {previewProfile.display_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{previewProfile.display_name}</h4>
                        <p className="text-xs font-mono text-cyan-400 truncate">{previewProfile.public_id}</p>
                      </div>
                      {isBlocked && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-semibold shrink-0">
                          Blocked
                        </span>
                      )}
                    </div>

                    {isBlocked ? (
                      <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-between text-xs text-rose-300">
                        <div className="flex items-center gap-2">
                          <Ban className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>This user is blocked</span>
                        </div>
                        <button
                          onClick={async () => {
                            await unblockContact(previewProfile.id);
                            setSuccessMsg(`Unblocked ${previewProfile.display_name}! You can now connect.`);
                          }}
                          className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md transition-all"
                        >
                          Unblock
                        </button>
                      </div>
                    ) : existingContact ? (
                      <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 flex items-center justify-between text-xs text-emerald-300">
                        <span className="font-medium">Already in your contacts!</span>
                        <button
                          onClick={() => {
                            selectDirectChat(existingContact);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md transition-all flex items-center gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Open Chat
                        </button>
                      </div>
                    ) : incomingReq ? (
                      <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-800/80 flex items-center justify-between text-xs text-cyan-300">
                        <span className="font-medium">Sent you a request!</span>
                        <button
                          onClick={async () => {
                            setIsSending(true);
                            const ok = await acceptRequest(incomingReq);
                            setIsSending(false);
                            if (ok) {
                              setSuccessMsg(`Connected with ${previewProfile.display_name}! Opening chat...`);
                              setTimeout(() => {
                                const newContact = contacts.find(c => c.contact_id === previewProfile.id);
                                if (newContact) selectDirectChat(newContact);
                                onClose();
                              }, 600);
                            }
                          }}
                          disabled={isSending}
                          className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md transition-all flex items-center gap-1.5"
                        >
                          {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Accept & Chat
                        </button>
                      </div>
                    ) : outgoingReq ? (
                      <div className="space-y-2">
                        <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-center justify-between">
                          <span>Request already sent · Pending</span>
                          <button
                            onClick={handleSendRequest}
                            disabled={isSending}
                            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[11px] font-semibold cursor-pointer"
                          >
                            Resend / Ping
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] text-slate-400">
                          Direct P2P communication begins immediately once they accept or scan your QR code.
                        </p>

                        <button
                          onClick={handleSendRequest}
                          disabled={isSending}
                          className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                          Send Contact Request
                        </button>
                      </>
                    )}
                  </div>
                );
              })()}
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
