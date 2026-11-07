import React, { useState, useEffect } from 'react';
import { 
  Search, 
  UserPlus, 
  Users, 
  MessageSquare
} from 'lucide-react';
import type { LocalConversation } from '@/types';
import { useChat } from '@/context/ChatContext';
import { localDb } from '@/services/db';

interface ContactsListProps {
  onOpenAddContact: () => void;
  onOpenCreateGroup: () => void;
}

export const ContactsList: React.FC<ContactsListProps> = ({
  onOpenAddContact,
  onOpenCreateGroup
}) => {
  const { 
    contacts, 
    groups, 
    selectedChat, 
    selectDirectChat, 
    selectGroupChat, 
    onlineUsers, 
    peerStatuses 
  } = useChat();

  const [activeTab, setActiveTab] = useState<'direct' | 'groups'>('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Map<string, LocalConversation>>(new Map());

  // Load recent local conversation snippets from IndexedDB
  useEffect(() => {
    let mounted = true;
    localDb.conversations.toArray().then((list) => {
      if (mounted) {
        const map = new Map<string, LocalConversation>();
        for (const c of list) {
          map.set(c.id, c);
        }
        setConversations(map);
      }
    });

    const interval = setInterval(() => {
      localDb.conversations.toArray().then((list) => {
        if (mounted) {
          const map = new Map<string, LocalConversation>();
          for (const c of list) map.set(c.id, c);
          setConversations(map);
        }
      });
    }, 4000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // STRICT PRIVACY RULE: Search queries ONLY filter the user's local contact list.
  // There is NO global user search or email directory lookup.
  const filteredContacts = contacts.filter((c) =>
    c.profile.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.profile.public_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full md:w-80 lg:w-96 border-r border-slate-800/90 bg-slate-950 flex flex-col h-full shrink-0">
      {/* Search & Actions Header */}
      <div className="p-4 border-b border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('direct')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'direct'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Chats ({contacts.length})
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'groups'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Groups ({groups.length})
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenAddContact}
              className="p-2 text-cyan-400 hover:bg-cyan-950/70 border border-cyan-800/50 rounded-xl transition-colors cursor-pointer"
              title="Add Contact via QR / ID"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenCreateGroup}
              className="p-2 text-sky-400 hover:bg-sky-950/70 border border-sky-800/50 rounded-xl transition-colors cursor-pointer"
              title="New Mesh Group"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Local Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within accepted contacts..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
        {activeTab === 'direct' ? (
          filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="text-xs font-medium text-slate-400">No contacts found</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Scan a permanent QR code or enter a unique public ID to connect.
              </p>
              <button
                onClick={onOpenAddContact}
                className="mt-4 px-3 py-1.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded-lg text-xs font-semibold hover:bg-cyan-900 cursor-pointer"
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
                  className={`p-3.5 flex items-center gap-3 hover:bg-slate-900/70 transition-colors cursor-pointer ${
                    isSelected ? 'bg-slate-900 border-l-4 border-cyan-500' : ''
                  }`}
                >
                  {/* Avatar & Presence Dot */}
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-cyan-600 to-sky-500 flex items-center justify-center text-sm font-bold text-slate-950 overflow-hidden shadow-sm">
                      {contact.profile.avatar_data ? (
                        <img src={contact.profile.avatar_data} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        contact.profile.display_name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-950 ${
                        isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                    />
                  </div>

                  {/* Contact Info & Last Snippet */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {contact.profile.display_name}
                      </h4>
                      {conv?.lastMessageTimestamp && (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(conv.lastMessageTimestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <p className="text-slate-400 truncate max-w-[180px] text-[11px]">
                        {conv?.lastMessageText || contact.profile.public_id}
                      </p>

                      {/* Connection status badge */}
                      {p2pStatus === 'connected' ? (
                        <span className="text-[10px] text-emerald-400 font-medium shrink-0">
                          Connected
                        </span>
                      ) : isOnline ? (
                        <span className="text-[10px] text-sky-400 shrink-0">Online</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 shrink-0">Offline</span>
                      )}
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {conv?.unreadCount && conv.unreadCount > 0 ? (
                    <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {conv.unreadCount}
                    </span>
                  ) : null}
                </div>
              );
            })
          )
        ) : (
          filteredGroups.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Users className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="text-xs font-medium text-slate-400">No mesh groups</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Create a host-coordinated mesh group with your accepted contacts.
              </p>
              <button
                onClick={onOpenCreateGroup}
                className="mt-4 px-3 py-1.5 bg-sky-950 text-sky-300 border border-sky-800 rounded-lg text-xs font-semibold hover:bg-sky-900 cursor-pointer"
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
                  className={`p-3.5 flex items-center gap-3 hover:bg-slate-900/70 transition-colors cursor-pointer ${
                    isSelected ? 'bg-slate-900 border-l-4 border-sky-500' : ''
                  }`}
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Users className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-sm font-semibold text-white truncate">{group.name}</h4>
                      {conv?.lastMessageTimestamp && (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(conv.lastMessageTimestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
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
    </div>
  );
};
