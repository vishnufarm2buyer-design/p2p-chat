import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  UserPlus, 
  Bell, 
  QrCode, 
  Download,
  Lock
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
  onOpenRequests
}) => {
  const { currentUser } = useAuth();
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
    <header className="md:hidden h-14 border-b border-white/[0.06] bg-slate-950/90 backdrop-blur-xl px-3.5 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* User Avatar (Opens Profile & QR Code) */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenProfile}
          className="relative p-0.5 rounded-full ring-2 ring-cyan-500/30 hover:ring-cyan-400 transition-all cursor-pointer"
          title="Open Profile & QR"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center text-xs font-bold text-slate-950 overflow-hidden shadow-sm">
            {currentUser?.avatar_data ? (
              <img src={currentUser.avatar_data} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              currentUser?.display_name.substring(0, 2).toUpperCase() || 'ME'
            )}
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950" />
        </button>

        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm font-bold text-white tracking-wide">Shield P2P</h1>
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Lock className="w-2.5 h-2.5" />
              E2EE
            </span>
          </div>
          <p className="text-[10px] text-slate-400">Direct STUN WebRTC</p>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1">
        {/* Install PWA Button */}
        {installPrompt && !isInstalled && (
          <button
            onClick={handleInstallClick}
            className="p-2 text-cyan-400 hover:bg-white/[0.06] rounded-xl transition-all cursor-pointer"
            title="Install App"
          >
            <Download className="w-4 h-4 animate-bounce" />
          </button>
        )}

        {/* QR Code */}
        <button
          onClick={onOpenProfile}
          className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer"
          title="My QR Code"
        >
          <QrCode className="w-4.5 h-4.5" />
        </button>

        {/* Requests Badge */}
        <button
          onClick={onOpenRequests}
          className="relative p-2 text-slate-400 hover:text-cyan-400 hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer"
          title="Contact Requests"
        >
          <Bell className="w-4.5 h-4.5" />
          {pendingRequestsCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 text-[9px] font-bold bg-cyan-500 text-slate-950 rounded-full flex items-center justify-center animate-pulse shadow-sm">
              {pendingRequestsCount}
            </span>
          )}
        </button>

        {/* Add Contact */}
        <button
          onClick={onOpenAddContact}
          className="p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-xl transition-colors cursor-pointer"
          title="Add Contact"
        >
          <UserPlus className="w-4.5 h-4.5" />
        </button>
      </div>
    </header>
  );
};
