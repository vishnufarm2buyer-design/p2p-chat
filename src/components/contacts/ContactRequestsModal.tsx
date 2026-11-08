import React, { useState } from 'react';
import { X, Check, Trash2, Clock, UserPlus } from 'lucide-react';
import { useChat } from '@/context/ChatContext';

interface ContactRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactRequestsModal: React.FC<ContactRequestsModalProps> = ({ isOpen, onClose }) => {
  const { contactRequests, acceptRequest, rejectRequest, cancelRequest, refreshRequests } = useChat();
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [processingId, setProcessingId] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      refreshRequests();
    }
  }, [isOpen, refreshRequests]);

  if (!isOpen) return null;

  const handleAccept = async (req: any) => {
    setProcessingId(req.id);
    await acceptRequest(req);
    setProcessingId(null);
  };

  const handleReject = async (req: any) => {
    setProcessingId(req.id);
    await rejectRequest(req);
    setProcessingId(null);
  };

  const incomingCount = contactRequests.incoming.length;
  const outgoingCount = contactRequests.outgoing.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-md bg-slate-950/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Contact Requests</h3>
              <p className="text-[10px] text-slate-400">Manage peer connection invitations</p>
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
              onClick={() => setActiveTab('incoming')}
              className={`py-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'incoming'
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Incoming ({incomingCount})
            </button>
            <button
              onClick={() => setActiveTab('outgoing')}
              className={`py-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'outgoing'
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Outgoing ({outgoingCount})
            </button>
          </div>
        </div>

        {/* Content List */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-96 divide-y divide-white/[0.06]">
          {activeTab === 'incoming' ? (
            contactRequests.incoming.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-xs">No pending incoming requests.</p>
              </div>
            ) : (
              contactRequests.incoming.map((req) => (
                <div key={req.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 flex items-center justify-center font-bold text-slate-950 text-xs shrink-0 shadow-sm">
                      {req.sender_profile?.display_name?.substring(0, 2).toUpperCase() || 'P'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">
                        {req.sender_profile?.display_name || 'New Peer'}
                      </h4>
                      <p className="text-[10px] font-mono text-cyan-400 truncate">
                        {req.sender_profile?.public_id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleAccept(req)}
                      disabled={processingId === req.id}
                      className="p-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:opacity-95 text-slate-950 font-bold transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                      title="Accept Request"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleReject(req)}
                      disabled={processingId === req.id}
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/[0.08] transition-all cursor-pointer"
                      title="Decline Request"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )
          ) : (
            contactRequests.outgoing.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-xs">No pending outgoing requests.</p>
              </div>
            ) : (
              contactRequests.outgoing.map((req) => (
                <div key={req.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs shrink-0 shadow-sm">
                      {req.receiver_profile?.display_name?.substring(0, 2).toUpperCase() || 'P'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">
                        {req.receiver_profile?.display_name || 'Contact'}
                      </h4>
                      <p className="text-[10px] font-mono text-slate-400 truncate">
                        {req.receiver_profile?.public_id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1 text-[11px] text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 font-medium">
                      <Clock className="w-3 h-3 text-amber-400" />
                      Pending
                    </span>
                    <button
                      onClick={async () => {
                        setProcessingId(req.id);
                        await cancelRequest(req);
                        setProcessingId(null);
                      }}
                      disabled={processingId === req.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Cancel Request"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
};
