import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  QrCode, 
  UserPlus, 
  Info, 
  Activity, 
  LogOut, 
  Download,
  Bell
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';

interface HeaderProps {
  onOpenProfile: () => void;
  onOpenAddContact: () => void;
  onOpenRequests: () => void;
  onOpenPrivacy: () => void;
  onOpenDiagnostics: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenProfile,
  onOpenAddContact,
  onOpenRequests,
  onOpenPrivacy,
  onOpenDiagnostics
}) => {
  const { currentUser, signOut } = useAuth();
  const { contactRequests } = useChat();

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
    <header className="h-16 border-b border-slate-800 bg-slate-950/90 backdrop-blur px-4 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Privacy Badge */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center shadow-lg shadow-cyan-950/50">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-wide">Shield P2P</h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
              STUN Only • Zero Cloud
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            Direct browser-to-browser encrypted communication
          </p>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Install PWA Button */}
        {installPrompt && !isInstalled && (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/70 border border-cyan-800/80 rounded-lg hover:bg-cyan-900/60 transition-all cursor-pointer"
            title="Install PWA"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Install App</span>
          </button>
        )}

        {/* Network Diagnostics */}
        <button
          onClick={onOpenDiagnostics}
          className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
          title="Network & STUN Diagnostics"
        >
          <Activity className="w-5 h-5" />
        </button>

        {/* Privacy Transparency Info */}
        <button
          onClick={onOpenPrivacy}
          className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
          title="Privacy Architecture Transparency"
        >
          <Info className="w-5 h-5" />
        </button>

        {/* Add Contact Shortcut */}
        <button
          onClick={onOpenAddContact}
          className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
          title="Add Contact via Public ID or QR"
        >
          <UserPlus className="w-5 h-5" />
        </button>

        {/* Contact Requests Badge */}
        <button
          onClick={onOpenRequests}
          className="relative p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
          title="Contact Requests"
        >
          <Bell className="w-5 h-5" />
          {pendingRequestsCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 text-[10px] font-bold bg-cyan-500 text-slate-950 rounded-full flex items-center justify-center animate-pulse">
              {pendingRequestsCount}
            </span>
          )}
        </button>

        {/* Permanent QR Code Shortcut */}
        <button
          onClick={onOpenProfile}
          className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
          title="My Permanent QR Code"
        >
          <QrCode className="w-5 h-5" />
        </button>

        {/* Profile Pill */}
        {currentUser && (
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer ml-1"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center text-xs font-bold text-slate-950 overflow-hidden">
              {currentUser.avatar_data ? (
                <img src={currentUser.avatar_data} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                currentUser.display_name.substring(0, 2).toUpperCase()
              )}
            </div>
            <span className="text-xs font-medium text-slate-200 hidden md:inline max-w-[100px] truncate">
              {currentUser.display_name}
            </span>
          </button>
        )}

        {/* Logout */}
        <button
          onClick={signOut}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
