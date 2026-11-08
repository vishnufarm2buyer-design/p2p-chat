import React, { useState } from 'react';
import { X, Check, Trash2, Clock, UserPlus } from 'lucide-react';
import { useChat } from '@/context/ChatContext';

interface ContactRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactRequestsModal: React.FC<ContactRequestsModalProps> = ({ isOpen, onClose }) => {
  const { contactRequests, acceptRequest, rejectRequest, refreshRequests } = useChat();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Contact Requests</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 p-2 bg-slate-900/60 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'incoming'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Incoming ({incomingCount})
          </button>
          <button
            onClick={() => setActiveTab('outgoing')}
            className={`py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'outgoing'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Outgoing ({outgoingCount})
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-96 divide-y divide-slate-800/60">
          {activeTab === 'incoming' ? (
            contactRequests.incoming.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p className="text-xs">No pending incoming requests.</p>
              </div>
            ) : (
              contactRequests.incoming.map((req) => (
                <div key={req.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-sky-500 flex items-center justify-center font-bold text-slate-950 text-xs shrink-0">
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
                      className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all cursor-pointer"
                      title="Accept Request"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleReject(req)}
                      disabled={processingId === req.id}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-800 transition-all cursor-pointer"
                      title="Reject Request"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )
          ) : (
            contactRequests.outgoing.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p className="text-xs">No pending outgoing requests.</p>
              </div>
            ) : (
              contactRequests.outgoing.map((req) => (
                <div key={req.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs shrink-0">
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

                  <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-900/50">
                    <Clock className="w-3 h-3 animate-spin" />
                    Pending
                  </span>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
};
