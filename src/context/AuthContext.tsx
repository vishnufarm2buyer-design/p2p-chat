import React, { createContext, useContext, useEffect, useState } from 'react';
import type { UserProfile } from '@/types';
import { supabaseService, supabase } from '@/services/supabase';
import { cryptoService } from '@/services/crypto';
import { signalingService } from '@/services/webrtc/signaling';
import { peerManager } from '@/services/webrtc/peerManager';
import { groupMeshManager } from '@/services/webrtc/groupMeshManager';
import { localDb } from '@/services/db';

interface AuthContextType {
  currentUser: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsTestPeer: (name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (newName: string) => Promise<boolean>;
  updateLocalAvatar: (avatarDataUrl: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize session and device crypto
  useEffect(() => {
    let mounted = true;

    // Safety fallback: Never keep user stuck on loading splash for more than 2s
    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 2000);

    async function initAuth() {
      try {
        // Clean URL if stale OAuth error parameters are present
        if (window.location.hash.includes('error=') || window.location.search.includes('error=')) {
          console.warn('Clearing OAuth error from URL');
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const user = await supabaseService.getCurrentSessionUser();
        if (user && mounted) {
          // Load local avatar from IndexedDB (never server!)
          try {
            const localAvatar = await localDb.getSetting<string>('my_avatar');
            if (localAvatar) user.avatar_data = localAvatar;
          } catch (e) {
            console.warn('Avatar read error:', e);
          }

          setCurrentUser(user);
          setLoading(false); // Unblock UI immediately!

          // Run device crypto & WebRTC signaling in background without blocking UI
          cryptoService.getOrCreateDeviceKeypair().then(({ publicKeyJWK }) => {
            supabaseService.publishPublicKey(user.id, publicKeyJWK).catch(console.warn);
          }).catch(console.warn);

          signalingService.init(user.id, user.public_id, user.display_name).catch(console.warn);
          peerManager.init(user.id, user.display_name);
          groupMeshManager.init(user.id, user.display_name);
        } else if (mounted) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error during auth initialization:', err);
      } finally {
        if (mounted) setLoading(false);
        clearTimeout(safetyTimer);
      }
    }

    initAuth();

    // Listen to Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = await supabaseService.getCurrentSessionUser();
        if (user && mounted) {
          const localAvatar = await localDb.getSetting<string>('my_avatar');
          if (localAvatar) user.avatar_data = localAvatar;
          setCurrentUser(user);
          setLoading(false);
          cryptoService.getOrCreateDeviceKeypair().then(({ publicKeyJWK }) => {
            supabaseService.publishPublicKey(user.id, publicKeyJWK).catch(console.warn);
          }).catch(console.warn);
          signalingService.init(user.id, user.public_id, user.display_name).catch(console.warn);
          peerManager.init(user.id, user.display_name);
          groupMeshManager.init(user.id, user.display_name);
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setLoading(false);
        signalingService.cleanup();
        peerManager.cleanup();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    await supabaseService.signInWithGoogle();
  };

  const signInAsTestPeer = async (name?: string) => {
    await supabaseService.signInAsTestPeer(name);
  };

  const signOut = async () => {
    await supabaseService.signOut();
    signalingService.cleanup();
    peerManager.cleanup();
    setCurrentUser(null);
  };

  const updateDisplayName = async (newName: string): Promise<boolean> => {
    if (!currentUser) return false;
    const ok = await supabaseService.updateDisplayName(currentUser.id, newName);
    if (ok) {
      setCurrentUser(prev => prev ? { ...prev, display_name: newName } : null);
    }
    return ok;
  };

  const updateLocalAvatar = async (avatarDataUrl: string): Promise<void> => {
    if (!currentUser) return;
    // Save solely into IndexedDB - never uploaded to cloud storage!
    await localDb.setSetting('my_avatar', avatarDataUrl);
    setCurrentUser(prev => prev ? { ...prev, avatar_data: avatarDataUrl } : null);
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      loading,
      signInWithGoogle,
      signInAsTestPeer,
      signOut,
      updateDisplayName,
      updateLocalAvatar
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
