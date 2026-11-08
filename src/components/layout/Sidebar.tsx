import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  MessageSquare,
  Users,
  Bell,
  UserPlus,
  QrCode,
  Activity,
  Info,
  Download,
  LogOut,
  Search,
  MoreVertical,
  Phone,
  Video,
  UserMinus,
  Ban,
  X,
  Plus,
  Lock,
  Database
} from 'lucide-react';
import type { LocalConversation } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { localDb } from '@/services/db';

interface SidebarProps {
  onOpenProfile: () => void;
  onOpenAddContact: () => void;
  onOpenRequests: () => void;
  onOpenPrivacy: () => void;
  onOpenDiagnostics: () => void;
  onOpenCreateGroup: () => void;
  onOpenBackup: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenProfile,
  onOpenAddContact,
  onOpenRequests,
  onOpenPrivacy,
  onOpenDiagnostics,
  onOpenCreateGroup,
  onOpenBackup,
}) => {
  const { currentUser, signOut } = useAuth();
  const {
    contacts,
    groups,
    selectedChat,
    selectDirectChat,
    selectGroupChat,
    onlineUsers,
    peerStatuses,
    contactRequests,
    refreshContacts,
    deleteContact,
    blockContact,
    startCall,
  } = useChat();

  const [activeTab, setActiveTab] = useState<'direct' | 'groups'>('direct');
  const [filterMode, setFilterMode] = useState<'all' | 'online'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Map<string, LocalConversation>>(new Map());
  const [contactMenuOpen, setContactMenuOpen] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const pendingRequestsCount = contactRequests.incoming.length;

  // PWA install prompt handler
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { setIsInstalled(true); setInstallPrompt(null); }
  };

  useEffect(() => { refreshContacts(); }, [refreshContacts]);

  // Load conversation summaries from local IndexedDB
  useEffect(() => {
    let mounted = true;
    const load = () => {
      localDb.conversations.toArray().then((list) => {
        if (!mounted) return;
        const map = new Map<string, LocalConversation>();
        for (const c of list) map.set(c.id, c);
        setConversations(map);
      });
    };
    load();
    const iv = setInterval(load, 3000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  useEffect(() => {
    const handler = () => setContactMenuOpen(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    const match = c.profile.display_name.toLowerCase().includes(q) || c.profile.public_id.toLowerCase().includes(q);
    if (!match) return false;
    if (filterMode === 'online') return onlineUsers.has(c.contact_id);
    return true;
  });

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fmtTime = (ts?: number) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 86400000) return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <aside className="flex flex-col h-full overflow-hidden bg-obsidian-950 text-slate-100 select-none border-r border-white/[0.06]">
      {/* ── Top Brand Header ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] bg-obsidian-900/60 backdrop-blur-xl">
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-3 group cursor-pointer text-left focus:outline-none"
          title="Cryptographic Identity & Profile"
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform duration-300">
              <ShieldCheck className="w-5 h-5 text-slate-950" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-obsidian-950" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              Shield P2P
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                E2EE
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-emerald-400" />
              <span>STUN Direct · Zero Cloud</span>
            </div>
          </div>
        </button>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {installPrompt && !isInstalled && (
            <button 
              onClick={handleInstall} 
              title="Install Desktop/Mobile PWA"
              className="p-2 rounded-xl text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 animate-bounce" />
            </button>
          )}

          <button 
            onClick={onOpenProfile} 
            title="My Permanent QR Code"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
          </button>

          <button 
            onClick={onOpenRequests} 
            title="Contact Requests"
            className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {pendingRequestsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-cyan-500 text-slate-950 text-[9px] font-black flex items-center justify-center animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          <button 
            onClick={onOpenAddContact} 
            title="Add Contact / Scan QR"
            className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Segmented Control & Search ── */}
      <div className="shrink-0 p-3 space-y-2.5 border-b border-white/[0.05] bg-obsidian-950/40">
        {/* Modern Segmented Tab Pill */}
        <div className="flex p-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab('direct')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'direct'
                ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chats ({contacts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('groups')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'groups'
                ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Groups ({groups.length})</span>
          </button>

          {activeTab === 'direct' ? (
            <button
              onClick={onOpenAddContact}
              title="Add Contact"
              className="px-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onOpenCreateGroup}
              title="Create Mesh Group"
              className="px-2.5 rounded-xl bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'direct' ? 'Search contacts or ID...' : 'Search groups...'}
            className="w-full pl-9 pr-8 py-2 bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.06] border border-white/[0.06] focus:border-cyan-500/50 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter chips (Direct Chats) */}
        {activeTab === 'direct' && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({contacts.length})
            </button>
            <button
              onClick={() => setFilterMode('online')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'online'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Online ({contacts.filter(c => onlineUsers.has(c.contact_id)).length})</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Scrollable Contact / Group List ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {activeTab === 'direct' ? (
          filteredContacts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 my-auto">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-3 text-cyan-400 shadow-md">
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-200">
                {searchQuery ? 'No matching contacts' : filterMode === 'online' ? 'No contacts online' : 'No contacts yet'}
              </p>
              <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                {searchQuery ? 'Try another search term.' : 'Share your permanent QR code or add a friend via Public ID.'}
              </p>
              <button
                onClick={onOpenAddContact}
                className="mt-4 px-4 py-2 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
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
                  className={`group relative p-2.5 rounded-2xl transition-all duration-150 cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-500/15 via-sky-500/10 to-transparent border-l-3 border-cyan-400 shadow-sm'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  {/* Avatar & Online Dot */}
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 flex items-center justify-center text-sm font-black text-slate-950 overflow-hidden shadow-sm">
                      {contact.profile.avatar_data ? (
                        <img src={contact.profile.avatar_data} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        contact.profile.display_name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-obsidian-950 transition-colors ${
                        isOnline
                          ? 'bg-emerald-500 shadow-sm shadow-emerald-500/80 ring-2 ring-emerald-500/20'
                          : 'bg-slate-600'
                      }`}
                    />
                  </div>

                  {/* Info & Last Message */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[160px]">
                        {contact.profile.display_name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {fmtTime(conv?.lastMessageTimestamp)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs gap-2">
                      <p className="text-slate-400 truncate text-[11px] max-w-[150px]">
                        {conv?.lastMessageText || contact.profile.public_id}
                      </p>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {conv?.unreadCount && conv.unreadCount > 0 ? (
                          <span className="min-w-4.5 h-4.5 px-1.5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-black flex items-center justify-center shadow-sm">
                            {conv.unreadCount}
                          </span>
                        ) : null}

                        {p2pStatus === 'connected' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            P2P
                          </span>
                        ) : isOnline ? (
                          <span className="text-[10px] text-sky-400 font-medium">Online</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Kebab Context Options */}
                  <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setContactMenuOpen(contactMenuOpen === contact.contact_id ? null : contact.contact_id)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                      title="Contact Options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {contactMenuOpen === contact.contact_id && (
                      <div className="absolute right-0 mt-1 w-48 bg-obsidian-900 border border-white/10 rounded-2xl shadow-2xl py-1.5 z-40 animate-fade-in backdrop-blur-2xl">
                        <button
                          onClick={() => {
                            setContactMenuOpen(null);
                            selectDirectChat(contact);
                            startCall('voice');
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/[0.08] flex items-center gap-2.5 cursor-pointer transition-colors"
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
                          className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/[0.08] flex items-center gap-2.5 cursor-pointer transition-colors"
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
                          className="w-full px-3 py-2 text-left text-xs text-amber-400 hover:bg-white/[0.08] flex items-center gap-2.5 cursor-pointer transition-colors"
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
                          className="w-full px-3 py-2 text-left text-xs text-rose-400 hover:bg-white/[0.08] flex items-center gap-2.5 cursor-pointer transition-colors"
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
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 my-auto">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-3 text-sky-400 shadow-md">
                <Users className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-200">No mesh groups</p>
              <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                Create a host-coordinated mesh group with your accepted contacts.
              </p>
              <button
                onClick={onOpenCreateGroup}
                className="mt-4 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
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
                  className={`p-2.5 rounded-2xl transition-all duration-150 cursor-pointer flex items-center gap-3 ${
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
                      <h4 className="text-xs font-bold text-white truncate">{group.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {fmtTime(conv?.lastMessageTimestamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <p className="text-slate-400 truncate text-[11px]">
                        {conv?.lastMessageText || `${group.members.length} members`}
                      </p>
                      <span className="text-[10px] text-sky-400 font-semibold shrink-0">
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

      {/* ── Bottom Utility Dock ── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-t border-white/[0.06] bg-obsidian-900/50 backdrop-blur-xl">
        {currentUser && (
          <button
            onClick={onOpenProfile}
            title={`${currentUser.display_name} • Click to edit profile`}
            className="flex items-center gap-2.5 p-1 rounded-2xl hover:bg-white/[0.05] transition-colors cursor-pointer group"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center text-xs font-bold text-slate-950 overflow-hidden shadow-md">
                {currentUser.avatar_data ? (
                  <img src={currentUser.avatar_data} alt="Me" className="w-full h-full object-cover" />
                ) : (
                  currentUser.display_name.substring(0, 2).toUpperCase()
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-obsidian-950" />
            </div>
            <div className="text-left hidden lg:block">
              <p className="text-xs font-bold text-white leading-tight truncate max-w-[90px]">{currentUser.display_name}</p>
              <p className="text-[10px] font-mono text-cyan-400">Online</p>
            </div>
          </button>
        )}

        <div className="flex items-center gap-1">
          {/* Encrypted Backup & Device Portability */}
          <button
            onClick={onOpenBackup}
            title="Encrypted Backup & Portability"
            className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer"
          >
            <Database className="w-4 h-4" />
          </button>

          {/* STUN Network Diagnostics */}
          <button
            onClick={onOpenDiagnostics}
            title="STUN Network & NAT Diagnostics"
            className="p-2 text-slate-400 hover:text-sky-400 hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer"
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* Privacy Architecture Info */}
          <button
            onClick={onOpenPrivacy}
            title="Privacy Transparency & Architecture"
            className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Sign Out */}
          <button
            onClick={signOut}
            title="Sign Out"
            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
