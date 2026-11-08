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
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenProfile,
  onOpenAddContact,
  onOpenRequests,
  onOpenPrivacy,
  onOpenDiagnostics,
  onOpenCreateGroup,
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

  // PWA install prompt
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

  // Refresh contacts
  useEffect(() => { refreshContacts(); }, [refreshContacts]);

  // Load conversation snippets from IndexedDB
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

  // Close kebab menus on outside click
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
    // Sidebar shell: flex-col, h-100%, no overflow
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#161b22' }}>

      {/* ── Top brand header bar ─────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10,13,20,0.7)',
      }}>
        {/* Brand logo + name */}
        <button
          onClick={onOpenProfile}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          title="Profile & QR Code"
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #06b6d4, #0ea5e9, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(6,182,212,0.25)',
          }}>
            <ShieldCheck size={20} color="#0d1117" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3', lineHeight: 1.2 }}>Shield P2P</div>
            <div style={{ fontSize: 10, color: '#8b949e', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Lock size={9} color="#34d399" />
              STUN Only · Zero Cloud
            </div>
          </div>
        </button>

        {/* Top right action icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {installPrompt && !isInstalled && (
            <button onClick={handleInstall} title="Install App"
              style={{ padding: 7, borderRadius: 10, border: 'none', background: 'none', color: '#06b6d4', cursor: 'pointer' }}>
              <Download size={16} />
            </button>
          )}
          <button onClick={onOpenProfile} title="My QR Code"
            style={{ padding: 7, borderRadius: 10, border: 'none', background: 'none', color: '#8b949e', cursor: 'pointer' }}>
            <QrCode size={16} />
          </button>
          <button onClick={onOpenRequests} title="Contact Requests"
            style={{ position: 'relative', padding: 7, borderRadius: 10, border: 'none', background: 'none', color: '#8b949e', cursor: 'pointer' }}>
            <Bell size={16} />
            {pendingRequestsCount > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                width: 16, height: 16, borderRadius: '50%',
                background: '#06b6d4', color: '#0d1117',
                fontSize: 9, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {pendingRequestsCount}
              </span>
            )}
          </button>
          <button onClick={onOpenAddContact} title="Add Contact"
            style={{ padding: 7, borderRadius: 10, border: 'none', background: 'rgba(6,182,212,0.1)', color: '#06b6d4', cursor: 'pointer' }}>
            <UserPlus size={16} />
          </button>
        </div>
      </div>

      {/* ── Tab switcher + search ─────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, gap: 3 }}>
          <button
            onClick={() => setActiveTab('direct')}
            style={{
              flex: 1, padding: '6px 8px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              background: activeTab === 'direct' ? 'linear-gradient(135deg, #06b6d4, #0ea5e9)' : 'transparent',
              color: activeTab === 'direct' ? '#0d1117' : '#8b949e',
              transition: 'all 0.15s',
            }}
          >
            <MessageSquare size={12} />
            Chats ({contacts.length})
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            style={{
              flex: 1, padding: '6px 8px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              background: activeTab === 'groups' ? 'linear-gradient(135deg, #06b6d4, #0ea5e9)' : 'transparent',
              color: activeTab === 'groups' ? '#0d1117' : '#8b949e',
              transition: 'all 0.15s',
            }}
          >
            <Users size={12} />
            Groups ({groups.length})
          </button>
          {activeTab === 'direct' ? (
            <button onClick={onOpenAddContact} title="Add Contact"
              style={{ padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: 'rgba(6,182,212,0.08)', color: '#06b6d4' }}>
              <UserPlus size={13} />
            </button>
          ) : (
            <button onClick={onOpenCreateGroup} title="Create Group"
              style={{ padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: 'rgba(14,165,233,0.08)', color: '#0ea5e9' }}>
              <Plus size={13} />
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8b949e', pointerEvents: 'none' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'direct' ? 'Search contacts or ID...' : 'Search groups...'}
            style={{
              width: '100%', boxSizing: 'border-box',
              paddingLeft: 30, paddingRight: searchQuery ? 28 : 10, paddingTop: 7, paddingBottom: 7,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8, outline: 'none', fontSize: 12, color: '#e6edf3',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e', display: 'flex' }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter chips for direct tab */}
        {activeTab === 'direct' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setFilterMode('all')}
              style={{
                padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                background: filterMode === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: filterMode === 'all' ? '#e6edf3' : '#8b949e',
              }}
            >
              All ({contacts.length})
            </button>
            <button
              onClick={() => setFilterMode('online')}
              style={{
                padding: '3px 10px', borderRadius: 6, border: `1px solid ${filterMode === 'online' ? 'rgba(52,211,153,0.4)' : 'transparent'}`, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                background: filterMode === 'online' ? 'rgba(52,211,153,0.08)' : 'transparent',
                color: filterMode === 'online' ? '#34d399' : '#8b949e',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
              Online ({contacts.filter(c => onlineUsers.has(c.contact_id)).length})
            </button>
          </div>
        )}
      </div>

      {/* ── Scrollable list ─────────────────────────────────────────────────────
           CRITICAL: flex:1 + minHeight:0 makes it shrink and scroll correctly  */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {activeTab === 'direct' ? (
          filteredContacts.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', color: '#8b949e' }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: '#06b6d4' }}>
                <MessageSquare size={22} />
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#c9d1d9', margin: '0 0 4px' }}>
                {searchQuery ? 'No matches' : filterMode === 'online' ? 'No contacts online' : 'No contacts yet'}
              </p>
              <p style={{ fontSize: 11, margin: '0 0 16px', maxWidth: 200 }}>
                {searchQuery ? 'Try a different query.' : 'Share your QR code or enter a friend\'s public ID.'}
              </p>
              <button onClick={onOpenAddContact}
                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#06b6d4,#0ea5e9)', color: '#0d1117' }}>
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
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px',
                    borderRadius: 12, cursor: 'pointer', transition: 'background 0.15s',
                    background: isSelected ? 'rgba(6,182,212,0.12)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #06b6d4' : '3px solid transparent',
                    position: 'relative',
                  }}
                  className="contact-row"
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#0891b2,#0ea5e9,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#0d1117', overflow: 'hidden' }}>
                      {contact.profile.avatar_data ? (
                        <img src={contact.profile.avatar_data} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : contact.profile.display_name.substring(0, 2).toUpperCase()}
                    </div>
                    <span style={{
                      position: 'absolute', bottom: -1, right: -1, width: 13, height: 13, borderRadius: '50%',
                      border: '2px solid #161b22',
                      background: isOnline ? '#34d399' : '#374151',
                      boxShadow: isOnline ? '0 0 6px rgba(52,211,153,0.6)' : 'none',
                    }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                        {contact.profile.display_name}
                      </span>
                      <span style={{ fontSize: 10, color: '#8b949e', flexShrink: 0 }}>{fmtTime(conv?.lastMessageTimestamp)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontSize: 11, color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                        {conv?.lastMessageText || contact.profile.public_id}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {conv?.unreadCount && conv.unreadCount > 0 ? (
                          <span style={{ minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: '#06b6d4', color: '#0d1117', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {conv.unreadCount}
                          </span>
                        ) : null}
                        {p2pStatus === 'connected' ? (
                          <span style={{ fontSize: 9, color: '#34d399', fontWeight: 700 }}>P2P</span>
                        ) : isOnline ? (
                          <span style={{ fontSize: 9, color: '#38bdf8', fontWeight: 600 }}>Online</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Kebab menu */}
                  <div style={{ position: 'relative', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setContactMenuOpen(contactMenuOpen === contact.contact_id ? null : contact.contact_id)}
                      style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'none', color: '#8b949e' }}
                      title="Options"
                    >
                      <MoreVertical size={15} />
                    </button>
                    {contactMenuOpen === contact.contact_id && (
                      <div style={{
                        position: 'absolute', right: 0, top: '100%', marginTop: 4,
                        width: 170, background: '#1c2128', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 50,
                        padding: '6px 0',
                      }}>
                        <button onClick={() => { setContactMenuOpen(null); selectDirectChat(contact); startCall('voice'); }}
                          style={{ width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                          <Phone size={13} color="#34d399" /> Voice Call
                        </button>
                        <button onClick={() => { setContactMenuOpen(null); selectDirectChat(contact); startCall('video'); }}
                          style={{ width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                          <Video size={13} color="#06b6d4" /> Video Call
                        </button>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '4px 0' }} />
                        <button onClick={async () => { setContactMenuOpen(null); if (confirm(`Remove ${contact.profile.display_name}?`)) await deleteContact(contact.contact_id); }}
                          style={{ width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                          <UserMinus size={13} /> Remove Contact
                        </button>
                        <button onClick={async () => { setContactMenuOpen(null); if (confirm(`Block ${contact.profile.display_name}?`)) await blockContact(contact.contact_id); }}
                          style={{ width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                          <Ban size={13} /> Block Contact
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', color: '#8b949e' }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: '#0ea5e9' }}>
                <Users size={22} />
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#c9d1d9', margin: '0 0 4px' }}>No mesh groups</p>
              <p style={{ fontSize: 11, margin: '0 0 16px', maxWidth: 200 }}>Create a host-coordinated mesh group with your contacts.</p>
              <button onClick={onOpenCreateGroup}
                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: '#0ea5e9', color: '#0d1117' }}>
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
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px',
                    borderRadius: 12, cursor: 'pointer', transition: 'background 0.15s',
                    background: isSelected ? 'rgba(14,165,233,0.12)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #0ea5e9' : '3px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#0369a1,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={18} color="white" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {group.name}
                      </span>
                      <span style={{ fontSize: 10, color: '#8b949e', flexShrink: 0 }}>{fmtTime(conv?.lastMessageTimestamp)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv?.lastMessageText || `${group.members.length} members`}
                      </span>
                      <span style={{ fontSize: 9, color: '#38bdf8', fontWeight: 600, flexShrink: 0 }}>Mesh</span>
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* ── Bottom utility bar ─────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10,13,20,0.5)',
      }}>
        {/* User avatar pill */}
        {currentUser && (
          <button onClick={onOpenProfile} title={`${currentUser.display_name} — Profile`}
            style={{ position: 'relative', padding: 2, borderRadius: '50%', border: '2px solid rgba(6,182,212,0.3)', cursor: 'pointer', background: 'none', display: 'flex' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#06b6d4,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0d1117', overflow: 'hidden' }}>
              {currentUser.avatar_data ? (
                <img src={currentUser.avatar_data} alt="Me" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : currentUser.display_name.substring(0, 2).toUpperCase()}
            </div>
            <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: '#34d399', border: '2px solid #161b22' }} />
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button onClick={onOpenDiagnostics} title="Network Diagnostics"
            style={{ padding: 7, borderRadius: 8, border: 'none', background: 'none', color: '#8b949e', cursor: 'pointer' }}>
            <Activity size={15} />
          </button>
          <button onClick={onOpenPrivacy} title="Privacy & Security"
            style={{ padding: 7, borderRadius: 8, border: 'none', background: 'none', color: '#8b949e', cursor: 'pointer' }}>
            <Info size={15} />
          </button>
          <button onClick={signOut} title="Sign Out"
            style={{ padding: 7, borderRadius: 8, border: 'none', background: 'none', color: '#8b949e', cursor: 'pointer' }}>
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
