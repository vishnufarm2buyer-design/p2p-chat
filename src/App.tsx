import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ChatProvider, useChat } from '@/context/ChatContext';
import { LandingPage } from '@/components/landing/LandingPage';
import { Header } from '@/components/layout/Header';
import { ContactsList } from '@/components/contacts/ContactsList';
import { ChatArea } from '@/components/chat/ChatArea';
import { GroupChatArea } from '@/components/group/GroupChatArea';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { AddContactModal } from '@/components/contacts/AddContactModal';
import { ContactRequestsModal } from '@/components/contacts/ContactRequestsModal';
import { CreateGroupModal } from '@/components/group/CreateGroupModal';
import { PrivacyModal } from '@/components/privacy/PrivacyModal';
import { NetworkDiagnosticsModal } from '@/components/diagnostics/NetworkDiagnosticsModal';
import { IncomingCallDialog } from '@/components/call/IncomingCallDialog';
import { CallOverlay } from '@/components/call/CallOverlay';
import { ShieldCheck, Loader2 } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { selectedChat } = useChat();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Application Header */}
      <Header
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAddContact={() => setIsAddContactOpen(true)}
        onOpenRequests={() => setIsRequestsOpen(true)}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
      />

      {/* Main Workspace (Split View / Responsive) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Contacts Sidebar: Visible on desktop, or mobile when no chat is active */}
        <div className={`w-full md:w-auto h-full ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
          <ContactsList
            onOpenAddContact={() => setIsAddContactOpen(true)}
            onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
          />
        </div>

        {/* Chat / Group Conversation Area: Visible on desktop, or mobile when chat is active */}
        <div className={`flex-1 h-full ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
          {selectedChat?.type === 'group' ? (
            <GroupChatArea />
          ) : (
            <ChatArea />
          )}
        </div>
      </div>

      {/* Modals & Dialogs */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <AddContactModal
        isOpen={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
      />

      <ContactRequestsModal
        isOpen={isRequestsOpen}
        onClose={() => setIsRequestsOpen(false)}
      />

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
      />

      <PrivacyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />

      <NetworkDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />

      {/* Live Voice & Video Calling Overlays */}
      <IncomingCallDialog />
      <CallOverlay />
    </div>
  );
};

const AppContent: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100">
        <div className="w-16 h-16 rounded-2xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 mb-4 shadow-xl shadow-cyan-950/50">
          <ShieldCheck className="w-8 h-8 animate-pulse" />
        </div>
        <p className="text-sm font-semibold tracking-wide text-white">Shield P2P</p>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Initializing Cryptographic Identity & IndexedDB...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <LandingPage />;
  }

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
