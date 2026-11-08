import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ChatProvider, useChat } from '@/context/ChatContext';
import { LandingPage } from '@/components/landing/LandingPage';
import { NavigationRail } from '@/components/layout/NavigationRail';
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

  const [activeTab, setActiveTab] = useState<'direct' | 'groups'>('direct');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-[#070a12] text-slate-100 select-none">
      {/* 1. Desktop Navigation Rail (Hidden on mobile) */}
      <NavigationRail
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAddContact={() => setIsAddContactOpen(true)}
        onOpenRequests={() => setIsRequestsOpen(true)}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
      />

      {/* 2. Main Responsive Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header: Visible ONLY on mobile when browsing conversations list */}
        {!selectedChat && (
          <Header
            onOpenProfile={() => setIsProfileOpen(true)}
            onOpenAddContact={() => setIsAddContactOpen(true)}
            onOpenRequests={() => setIsRequestsOpen(true)}
            onOpenPrivacy={() => setIsPrivacyOpen(true)}
            onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
          />
        )}

        {/* Split View Container */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Contacts Sidebar: Visible on desktop, or mobile when no chat is active */}
          <div className={`w-full md:w-80 lg:w-96 h-full shrink-0 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
            <ContactsList
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onOpenAddContact={() => setIsAddContactOpen(true)}
              onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
            />
          </div>

          {/* Conversation Area: Visible on desktop, or mobile when chat is active */}
          <div className={`flex-1 h-full ${!selectedChat ? 'hidden md:flex' : 'flex flex-col'}`}>
            {selectedChat?.type === 'group' ? (
              <GroupChatArea />
            ) : (
              <ChatArea />
            )}
          </div>
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

      {/* Live Audio & Video Calling Overlays */}
      <IncomingCallDialog />
      <CallOverlay />
    </div>
  );
};

const AppContent: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#070a12] text-slate-100">
        <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 shadow-2xl shadow-cyan-500/10">
          <ShieldCheck className="w-8 h-8 animate-pulse" />
        </div>
        <p className="text-sm font-bold tracking-wide text-white">Shield P2P</p>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
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
