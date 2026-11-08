import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ChatProvider, useChat } from '@/context/ChatContext';
import { LandingPage } from '@/components/landing/LandingPage';
import { Sidebar } from '@/components/layout/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { GroupChatArea } from '@/components/group/GroupChatArea';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { AddContactModal } from '@/components/contacts/AddContactModal';
import { ContactRequestsModal } from '@/components/contacts/ContactRequestsModal';
import { CreateGroupModal } from '@/components/group/CreateGroupModal';
import { PrivacyModal } from '@/components/privacy/PrivacyModal';
import { NetworkDiagnosticsModal } from '@/components/diagnostics/NetworkDiagnosticsModal';
import { BackupModal } from '@/components/backup/BackupModal';
import { IncomingCallDialog } from '@/components/call/IncomingCallDialog';
import { CallOverlay } from '@/components/call/CallOverlay';
import { ShieldCheck, Loader2 } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT RULES (read before editing):
//   • Root = h-screen / overflow-hidden
//   • Every flex chain needs min-h-0 / min-w-0 on children so overflow-y-auto works
//   • Sidebar: flex-col h-full overflow-hidden, scroll list = flex-1 overflow-y-auto min-h-0
//   • ChatArea: flex-col h-full overflow-hidden, messages = flex-1 overflow-y-auto min-h-0
// ─────────────────────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { selectedChat } = useChat();

  const [isProfileOpen,     setIsProfileOpen]     = useState(false);
  const [isAddContactOpen,  setIsAddContactOpen]  = useState(false);
  const [isRequestsOpen,    setIsRequestsOpen]    = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isPrivacyOpen,     setIsPrivacyOpen]     = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isBackupOpen,      setIsBackupOpen]      = useState(false);

  // Detect mobile viewport
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const modalHandlers = {
    onOpenProfile:     () => setIsProfileOpen(true),
    onOpenAddContact:  () => setIsAddContactOpen(true),
    onOpenRequests:    () => setIsRequestsOpen(true),
    onOpenPrivacy:     () => setIsPrivacyOpen(true),
    onOpenDiagnostics: () => setIsDiagnosticsOpen(true),
    onOpenCreateGroup: () => setIsCreateGroupOpen(true),
    onOpenBackup:      () => setIsBackupOpen(true),
  };

  const chatOpen = selectedChat !== null;

  // On mobile: show sidebar OR chat (not both)
  // On desktop: always show both
  const showSidebar = !isMobile || !chatOpen;
  const showChat    = !isMobile || chatOpen;

  return (
    // Shell: fills 100dvh, no overflow
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: '#0d1117' }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      {showSidebar && (
        <div style={{
          width: isMobile ? '100%' : 320,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.07)',
          background: '#161b22',
        }}>
          <Sidebar {...modalHandlers} />
        </div>
      )}

      {/* ── Chat workspace ─────────────────────────────────────────────────────── */}
      {showChat && (
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          background: '#0d1117',
        }}>
          {selectedChat?.type === 'group' ? <GroupChatArea /> : <ChatArea {...modalHandlers} />}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      <ProfileModal         isOpen={isProfileOpen}     onClose={() => setIsProfileOpen(false)} />
      <AddContactModal      isOpen={isAddContactOpen}  onClose={() => setIsAddContactOpen(false)} />
      <ContactRequestsModal isOpen={isRequestsOpen}    onClose={() => setIsRequestsOpen(false)} />
      <CreateGroupModal     isOpen={isCreateGroupOpen} onClose={() => setIsCreateGroupOpen(false)} />
      <PrivacyModal         isOpen={isPrivacyOpen}     onClose={() => setIsPrivacyOpen(false)} />
      <NetworkDiagnosticsModal isOpen={isDiagnosticsOpen} onClose={() => setIsDiagnosticsOpen(false)} />
      <BackupModal          isOpen={isBackupOpen}      onClose={() => setIsBackupOpen(false)} />

      {/* ── Calling overlays ──────────────────────────────────────────────────── */}
      <IncomingCallDialog />
      <CallOverlay />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const AppContent: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d1117', color: '#e6edf3' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <ShieldCheck size={28} color="#06b6d4" />
        </div>
        <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 6px' }}>Shield P2P</p>
        <p style={{ fontSize: 12, color: '#8b949e', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Loader2 size={13} className="animate-spin" />
          Initializing Cryptographic Identity &amp; IndexedDB…
        </p>
      </div>
    );
  }

  if (!currentUser) return <LandingPage />;

  return (
    <ChatProvider>
      <Dashboard />
    </ChatProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
