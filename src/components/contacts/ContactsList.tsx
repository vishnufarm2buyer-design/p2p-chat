import React, { useState, useEffect } from 'react';
import { 
  Search, 
  UserPlus, 
  Users, 
  MessageSquare,
  MoreVertical,
  Phone,
  Video,
  UserMinus,
  Ban,
  Shield,
  X,
  Plus
} from 'lucide-react';
import type { LocalConversation } from '@/types';
import { useChat } from '@/context/ChatContext';
import { localDb } from '@/services/db';

interface ContactsListProps {
  onOpenAddContact: () => void;
  onOpenCreateGroup: () => void;
  activeTab?: 'direct' | 'groups';
  onTabChange?: (tab: 'direct' | 'groups') => void;
}

export const ContactsList: React.FC<ContactsListProps> = ({
  onOpenAddContact,
  onOpenCreateGroup,
  activeTab: externalTab,
  onTabChange: externalTabChange
}) => {
  const { 
    contacts, 
    groups, 
    selectedChat, 
    selectDirectChat, 
    selectGroupChat, 
    onlineUsers, 
    peerStatuses,
    refreshContacts,
    deleteContact,
    blockContact,
    startCall
  } = useChat();

  const [internalTab, setInternalTab] = useState<'direct' | 'groups'>('direct');
  const activeTab = externalTab ?? internalTab;
  const setActiveTab = externalTabChange ?? setInternalTab;

  const [filterMode, setFilterMode] = useState<'all' | 'online'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Map<string, LocalConversation>>(new Map());
  const [contactMenuOpen, setContactMenuOpen] = useState<string | null>(null);

  // Periodically refresh contacts
  useEffect(() => {
    refreshContacts();
  }, [refreshContacts]);

  // Load recent local conversation snippets from IndexedDB
  useEffect(() => {
    let mounted = true;
    const loadConvs = () => {
      localDb.conversations.toArray().then((list) => {
        if (mounted) {
          const map = new Map<string, LocalConversation>();
          for (const c of list) map.set(c.id, c);
          setConversations(map);
        }
      });
    };

    loadConvs();
    const interval = setInterval(loadConvs, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Close menus on click outside
  useEffect(() => {
    const handleGlobalClick = () => setContactMenuOpen(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Filter contacts locally (NO server search)
  const filteredContacts = contacts.filter((c) => {
    const matchesSearch = 
      c.profile.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.profile.public_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (filterMode === 'online') {
      return onlineUsers.has(c.contact_id);
    }
    return true;
  });

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatMessageTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 86400000) {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full md:w-80 lg:w-96 bg-slate-950/70 md:bg-slate-900/30 border-r border-white/[0.06] flex flex-col h-full shrink-0 select-none relative backdrop-blur-xl">
      {/* Search & Tabs Header */}
      <div className="p-3.5 sm:p-4 border-b border-white/[0.06] space-y-3 shrink-0">
        {/* Mobile View Tab Switcher & Quick Add */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-white/[0.06] text-xs w-full max-w-xs">
            <button
              onClick={() => setActiveTab('direct')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'direct'
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chats ({contacts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'groups'
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Groups ({groups.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {activeTab === 'direct' ? (
              <button
                onClick={onOpenAddContact}
                className="p-2 text-cyan-400 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/50 rounded-xl transition-all cursor-pointer"
                title="Add Contact via QR / ID"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onOpenCreateGroup}
                className="p-2 text-sky-400 hover:text-white bg-sky-950/40 hover:bg-sky-900/50 border border-sky-800/50 rounded-xl transition-all cursor-pointer"
                title="Create Mesh Group"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search Input Box */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'direct' ? 'Search contacts or ID...' : 'Search mesh groups...'}
            className="w-full pl-9.5 pr-8 py-2 bg-slate-900/60 hover:bg-slate-900 border border-white/[0.06] focus:border-cyan-500/50 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-200 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips (Direct Chats) */}
        {activeTab === 'direct' && (
          <div className="flex items-center gap-1.5 text-[11px] pt-0.5">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-white/[0.04]'
              }`}
            >
              All ({contacts.length})
            </button>
            <button
              onClick={() => setFilterMode('online')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'online'
                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 font-semibold'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-white/[0.04]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online ({contacts.filter(c => onlineUsers.has(c.contact_id)).length})
            </button>
          </div>
        )}
      </div>

      {/* Conversations Scroll Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04] p-1.5 space-y-0.5">
        {activeTab === 'direct' ? (
          filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center my-auto">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3 text-cyan-400 shadow-lg">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-300">
                {searchQuery ? 'No matching contacts' : filterMode === 'online' ? 'No contacts online' : 'No contacts yet'}
              </p>
              <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                {searchQuery 
                  ? 'Try searching by public user ID or clear the search query.'
                  : 'Share your permanent QR code or enter a friend\'s public ID to connect.'}
              </p>
              <button
                onClick={onOpenAddContact}
                className="mt-4 px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                + Add Contact
              </button>
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isSelected = selectedChat?.id === contact.contact_id;
              const isOnline = onlineUsers.has(contact.contact_id);
              const p2pStatus = peerStatuses[contact.contact_id] || 'idle';
              const conv = conversations.get(contact.contact_id);

              return (
                <div
                  key={contact.contact_id}
                  onClick={() => selectDirectChat(contact)}
                  className={`group relative p-3 rounded-2xl transition-all duration-200 cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-500/15 via-sky-500/10 to-transparent border-l-3 border-cyan-400 shadow-sm'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  {/* Avatar & Online Dot */}
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-slate-950 overflow-hidden shadow-sm">
                      {contact.profile.avatar_data ? (
                        <img src={contact.profile.avatar_data} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        contact.profile.display_name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    {/* Live Presence Indicator */}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950 transition-colors ${
                        isOnline 
                          ? 'bg-emerald-500 shadow-sm shadow-emerald-500/80 ring-2 ring-emerald-500/20' 
                          : 'bg-slate-600'
                      }`}
                    />
                  </div>

                  {/* Contact Info & Message Preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-sm font-bold text-white truncate max-w-[140px] sm:max-w-[170px]">
                        {contact.profile.display_name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {formatMessageTime(conv?.lastMessageTimestamp)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs gap-2">
                      <p className="text-slate-400 truncate text-[11px] max-w-[160px]">
                        {conv?.lastMessageText || contact.profile.public_id}
                      </p>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Unread Pill */}
                        {conv?.unreadCount && conv.unreadCount > 0 ? (
                          <span className="min-w-4.5 h-4.5 px-1 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-black flex items-center justify-center shadow-sm">
                            {conv.unreadCount}
                          </span>
                        ) : null}

                        {/* Status dot */}
                        {p2pStatus === 'connected' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            P2P
                          </span>
                        ) : isOnline ? (
                          <span className="text-[10px] text-sky-400 font-medium">Online</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Kebab Context Options Menu */}
                  <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setContactMenuOpen(contactMenuOpen === contact.contact_id ? null : contact.contact_id)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                      title="Contact Options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {contactMenuOpen === contact.contact_id && (
                      <div className="absolute right-0 mt-1 w-44 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl py-1.5 z-40 animate-fade-in backdrop-blur-2xl">
                        <button
                          onClick={() => {
                            setContactMenuOpen(null);
                            selectDirectChat(contact);
                            startCall('voice');
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/[0.08] flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Voice Call</span>
                        </button>

                        <button
                          onClick={() => {
                            setContactMenuOpen(null);
                            selectDirectChat(contact);
                            startCall('video');
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/[0.08] flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Video className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Video Call</span>
                        </button>

                        <div className="border-t border-white/[0.08] my-1" />

                        <button
                          onClick={async () => {
                            setContactMenuOpen(null);
                            if (confirm(`Remove ${contact.profile.display_name} from contacts?`)) {
                              await deleteContact(contact.contact_id);
                            }
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-amber-400 hover:bg-white/[0.08] flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          <span>Remove Contact</span>
                        </button>

                        <button
                          onClick={async () => {
                            setContactMenuOpen(null);
                            if (confirm(`Block ${contact.profile.display_name}? They will not be able to connect or message you.`)) {
                              await blockContact(contact.contact_id);
                            }
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/[0.08] flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Block Contact</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : (
          filteredGroups.length === 0 ? (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center my-auto">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3 text-sky-400 shadow-lg">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-300">No mesh groups</p>
              <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                Create a host-coordinated mesh group with your accepted contacts.
              </p>
              <button
                onClick={onOpenCreateGroup}
                className="mt-4 px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                + New Group
              </button>
            </div>
          ) : (
            filteredGroups.map((group) => {
              const isSelected = selectedChat?.id === group.id;
              const conv = conversations.get(group.id);

              return (
                <div
                  key={group.id}
                  onClick={() => selectGroupChat(group)}
                  className={`p-3 rounded-2xl transition-all duration-200 cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'bg-gradient-to-r from-sky-500/15 via-indigo-500/10 to-transparent border-l-3 border-sky-400 shadow-sm'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Users className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-sm font-bold text-white truncate">{group.name}</h4>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {formatMessageTime(conv?.lastMessageTimestamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <p className="text-slate-400 truncate text-[11px]">
                        {conv?.lastMessageText || `${group.members.length} members`}
                      </p>
                      <span className="text-[10px] text-sky-400 font-medium shrink-0">
                        Mesh
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Floating Action Button for Mobile Add Contact */}
      <button
        onClick={onOpenAddContact}
        className="md:hidden absolute bottom-5 right-5 w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-sky-500 text-slate-950 shadow-xl shadow-cyan-500/30 flex items-center justify-center font-bold transition-transform active:scale-95 cursor-pointer z-30"
        title="Add Contact / Scan QR"
      >
        <UserPlus className="w-5 h-5" />
      </button>
    </div>
  );
};
