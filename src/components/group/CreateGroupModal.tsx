import React, { useState } from 'react';
import { X, Users, Check, AlertCircle, Loader2 } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white">Create Mesh Group</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-900/60 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Group Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Project Shield Team"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Select Participants ({selectedUserIds.length}/5)
              </label>
              <span className="text-[10px] text-sky-400 font-medium">Full Mesh Topology</span>
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/60 border border-slate-800 rounded-xl bg-slate-900/40 p-1">
              {contacts.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-500">
                  No accepted contacts available. Add contacts first.
                </p>
              ) : (
                contacts.map((contact) => {
                  const isChecked = selectedUserIds.includes(contact.contact_id);

                  return (
                    <div
                      key={contact.contact_id}
                      onClick={() => toggleMember(contact.contact_id)}
                      className={`p-2.5 flex items-center justify-between rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer ${
                        isChecked ? 'bg-sky-950/40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                          {contact.profile.display_name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-slate-200 truncate">
                          {contact.profile.display_name}
                        </span>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-sky-500 border-sky-400 text-slate-950'
                            : 'border-slate-700 bg-slate-800'
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

          <p className="text-[11px] text-slate-400 leading-relaxed">
            In a full mesh group, you establish direct peer connections with each participant. The host coordinates connection setup but never relays any messages or media.
          </p>

          <button
            onClick={handleCreate}
            disabled={isCreating || !groupName.trim() || selectedUserIds.length === 0}
            className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
};
