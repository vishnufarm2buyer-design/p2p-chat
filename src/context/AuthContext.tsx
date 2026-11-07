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

    async function initAuth() {
      try {
        const user = await supabaseService.getCurrentSessionUser();
        if (user && mounted) {
          // Load local avatar from IndexedDB (never server!)
          const localAvatar = await localDb.getSetting<string>('my_avatar');
          if (localAvatar) {
            user.avatar_data = localAvatar;
          }

          setCurrentUser(user);

          // 1. Initialize or load device cryptographic keypair (ECDH P-256)
          const { publicKeyJWK } = await cryptoService.getOrCreateDeviceKeypair();

          // 2. Publish public key to Supabase (public identity table)
          await supabaseService.publishPublicKey(user.id, publicKeyJWK);

          // 3. Initialize Ephemeral WebRTC Signaling and Presence
          await signalingService.init(user.id, user.public_id, user.display_name);

          // 4. Initialize Peer Manager & Mesh Manager
          peerManager.init(user.id, user.display_name);
          groupMeshManager.init(user.id, user.display_name);
        }
      } catch (err) {
        console.error('Error during auth initialization:', err);
      } finally {
        if (mounted) setLoading(false);
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
          await signalingService.init(user.id, user.public_id, user.display_name);
          peerManager.init(user.id, user.display_name);
          groupMeshManager.init(user.id, user.display_name);
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
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
