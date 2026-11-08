import React, { useState } from 'react';
import { X, Users, Check, AlertCircle, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { useChat } from '@/context/ChatContext';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose }) => {
  const { contacts, createGroup } = useChat();

  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleMember = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    const trimmed = groupName.trim();
    if (!trimmed) {
      setErrorMsg('Please enter a group name.');
      return;
    }

    if (selectedUserIds.length === 0) {
      setErrorMsg('Please select at least one contact to join the group.');
      return;
    }

    if (selectedUserIds.length > 5) {
      setErrorMsg('WebRTC full mesh is optimized for small groups (up to 5 participants).');
      return;
    }

    setIsCreating(true);
    setErrorMsg(null);

    try {
      const res = await createGroup(trimmed, selectedUserIds);
      if (res) {
        onClose();
        setGroupName('');
        setSelectedUserIds([]);
      } else {
        setErrorMsg('Failed to create mesh group.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-slate-950/90 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create Mesh Group</h3>
              <p className="text-xs text-slate-400">Decentralized P2P full mesh group</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-800/60 text-xs text-red-200 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Group Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Shield Core Team"
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Select Participants ({selectedUserIds.length}/5)
              </label>
              <span className="text-[11px] text-cyan-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Full Mesh Topology
              </span>
            </div>

            <div className="max-h-52 overflow-y-auto divide-y divide-white/[0.04] border border-white/[0.08] rounded-2xl bg-white/[0.02] p-1.5">
              {contacts.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  <p>No contacts available yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Add contacts by Public ID or QR code first.</p>
                </div>
              ) : (
                contacts.map((contact) => {
                  const isChecked = selectedUserIds.includes(contact.contact_id);

                  return (
                    <div
                      key={contact.contact_id}
                      onClick={() => toggleMember(contact.contact_id)}
                      className={`p-2.5 flex items-center justify-between rounded-xl hover:bg-white/[0.05] transition-all cursor-pointer ${
                        isChecked ? 'bg-cyan-500/10 border border-cyan-500/30' : 'border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-sm">
                          {contact.profile.display_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">
                            {contact.profile.display_name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            {contact.profile.public_id}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                          isChecked
                            ? 'bg-cyan-400 border-cyan-300 text-slate-950 font-bold'
                            : 'border-white/20 bg-white/[0.05]'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-2.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              In a decentralized mesh, peers communicate directly with each other. No group messages or media are stored on any cloud server.
            </p>
          </div>

          <button
            onClick={handleCreate}
            disabled={isCreating || !groupName.trim() || selectedUserIds.length === 0}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold text-xs rounded-2xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            Create Decentralized Group
          </button>
        </div>
      </div>
    </div>
  );
};
