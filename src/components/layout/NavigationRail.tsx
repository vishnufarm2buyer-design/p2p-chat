import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  MessageSquare, 
  Users, 
  Bell, 
  UserPlus, 
  QrCode, 
  Info, 
  Activity, 
  Download, 
  LogOut 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';

interface NavigationRailProps {
  activeTab: 'direct' | 'groups';
  onTabChange: (tab: 'direct' | 'groups') => void;
  onOpenProfile: () => void;
  onOpenAddContact: () => void;
  onOpenRequests: () => void;
  onOpenPrivacy: () => void;
  onOpenDiagnostics: () => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeTab,
  onTabChange,
  onOpenProfile,
  onOpenAddContact,
  onOpenRequests,
  onOpenPrivacy,
  onOpenDiagnostics
}) => {
  const { currentUser, signOut } = useAuth();
  const { contactRequests, blockedUsers } = useChat();

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
    }
  };

  const pendingRequestsCount = contactRequests.incoming.length;

  return (
    <aside className="hidden md:flex flex-col items-center justify-between w-18 lg:w-20 py-5 bg-slate-950/90 border-r border-white/[0.06] backdrop-blur-2xl shrink-0 z-30 select-none">
      {/* Top Brand Logo */}
      <div className="flex flex-col items-center gap-6">
        <button
          onClick={onOpenProfile}
          className="relative group cursor-pointer"
          title="Shield P2P • Direct WebRTC"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 group-hover:shadow-cyan-500/40 transition-all duration-300">
            <ShieldCheck className="w-7 h-7 text-slate-950" />
          </div>
          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950 shadow-sm" />
        </button>

        {/* Navigation Tabs */}
        <nav className="flex flex-col items-center gap-2">
          {/* Direct Chats */}
          <button
            onClick={() => onTabChange('direct')}
            className={`relative p-3 rounded-2xl transition-all duration-200 cursor-pointer group ${
              activeTab === 'direct'
                ? 'bg-gradient-to-tr from-cyan-500/20 to-sky-500/10 text-cyan-400 border border-cyan-500/30 shadow-md shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]'
            }`}
            title="Direct Messages"
          >
            <MessageSquare className="w-5 h-5 transition-transform group-hover:scale-110" />
            {activeTab === 'direct' && (
              <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-cyan-400 rounded-r-full shadow-sm shadow-cyan-400/50" />
            )}
          </button>

          {/* Mesh Groups */}
          <button
            onClick={() => onTabChange('groups')}
            className={`relative p-3 rounded-2xl transition-all duration-200 cursor-pointer group ${
              activeTab === 'groups'
                ? 'bg-gradient-to-tr from-cyan-500/20 to-sky-500/10 text-cyan-400 border border-cyan-500/30 shadow-md shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]'
            }`}
            title="Mesh Groups"
          >
            <Users className="w-5 h-5 transition-transform group-hover:scale-110" />
            {activeTab === 'groups' && (
              <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-cyan-400 rounded-r-full shadow-sm shadow-cyan-400/50" />
            )}
          </button>

          {/* Contact Requests */}
          <button
            onClick={onOpenRequests}
            className="relative p-3 rounded-2xl text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] transition-all cursor-pointer group"
            title="Contact Requests"
          >
            <Bell className="w-5 h-5 transition-transform group-hover:scale-110" />
            {pendingRequestsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-5 h-5 text-[10px] font-bold bg-cyan-500 text-slate-950 rounded-full flex items-center justify-center shadow-md animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          {/* Add Contact */}
          <button
            onClick={onOpenAddContact}
            className="p-3 rounded-2xl text-slate-400 hover:text-cyan-400 hover:bg-white/[0.06] transition-all cursor-pointer group"
            title="Add Contact / Scan QR"
          >
            <UserPlus className="w-5 h-5 transition-transform group-hover:scale-110" />
          </button>
        </nav>
      </div>

      {/* Utility Actions */}
      <div className="flex flex-col items-center gap-3 w-full px-2">
        {/* PWA Install */}
        {installPrompt && !isInstalled && (
          <button
            onClick={handleInstallClick}
            className="p-3 rounded-2xl text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 hover:bg-cyan-900/60 transition-all cursor-pointer"
            title="Install PWA Application"
          >
            <Download className="w-5 h-5 animate-bounce" />
          </button>
        )}

        {/* Permanent QR Code */}
        <button
          onClick={onOpenProfile}
          className="p-3 rounded-2xl text-slate-400 hover:text-cyan-400 hover:bg-white/[0.06] transition-all cursor-pointer"
          title="My Permanent QR Code"
        >
          <QrCode className="w-5 h-5" />
        </button>

        {/* Network & STUN Diagnostics */}
        <button
          onClick={onOpenDiagnostics}
          className="p-3 rounded-2xl text-slate-400 hover:text-sky-400 hover:bg-white/[0.06] transition-all cursor-pointer"
          title="STUN Network Diagnostics"
        >
          <Activity className="w-5 h-5" />
        </button>

        {/* Privacy Architecture Transparency & Blocked Contacts */}
        <button
          onClick={onOpenPrivacy}
          className="relative p-3 rounded-2xl text-slate-400 hover:text-emerald-400 hover:bg-white/[0.06] transition-all cursor-pointer"
          title={blockedUsers.length > 0 ? `Privacy Architecture & Blocked Contacts (${blockedUsers.length} blocked)` : "Privacy Architecture & Blocked List"}
        >
          <Info className="w-5 h-5" />
          {blockedUsers.length > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-950 animate-pulse" />
          )}
        </button>

        <div className="w-8 h-[1px] bg-white/[0.08] my-1" />

        {/* User Profile Avatar Pill */}
        {currentUser && (
          <button
            onClick={onOpenProfile}
            className="relative p-0.5 rounded-full transition-transform hover:scale-105 cursor-pointer ring-2 ring-transparent hover:ring-cyan-500/50"
            title={`${currentUser.display_name} • Click to edit profile`}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center text-xs font-bold text-slate-950 overflow-hidden shadow-md">
              {currentUser.avatar_data ? (
                <img src={currentUser.avatar_data} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                currentUser.display_name.substring(0, 2).toUpperCase()
              )}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 shadow-sm" />
          </button>
        )}

        {/* Logout */}
        <button
          onClick={signOut}
          className="p-3 rounded-2xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
};
