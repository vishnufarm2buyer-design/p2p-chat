import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { 
  ContactItem, 
  ContactRequest, 
  GroupItem, 
  UserProfile, 
  PeerConnectionStatus,
  ActiveCallState,
  LocalMessage
} from '@/types';
import { supabaseService } from '@/services/supabase';
import { peerManager } from '@/services/webrtc/peerManager';
import { groupMeshManager } from '@/services/webrtc/groupMeshManager';
import { signalingService } from '@/services/webrtc/signaling';
import { useAuth } from './AuthContext';
import { localDb } from '@/services/db';

export interface SelectedChat {
  type: 'direct' | 'group';
  id: string; // contact_id or group_id
  name: string;
  profile?: UserProfile;
  group?: GroupItem;
}

interface ChatContextType {
  contacts: ContactItem[];
  contactRequests: { incoming: ContactRequest[]; outgoing: ContactRequest[] };
  groups: GroupItem[];
  selectedChat: SelectedChat | null;
  onlineUsers: Set<string>;
  peerStatuses: Record<string, PeerConnectionStatus>;
  peerErrors: Record<string, string>;
  typingUsers: Record<string, boolean>;
  activeCall: ActiveCallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  
  // Actions
  selectDirectChat: (contact: ContactItem) => void;
  selectGroupChat: (group: GroupItem) => void;
  closeChat: () => void;
  refreshContacts: () => Promise<void>;
  refreshRequests: () => Promise<void>;
  refreshGroups: () => Promise<void>;
  sendContactRequestByPublicId: (publicId: string) => Promise<{ 
    success: boolean; 
    error?: string; 
    autoAccepted?: boolean; 
    alreadyContact?: boolean;
    isPending?: boolean;
    message?: string;
    targetProfile?: UserProfile;
  }>;
  acceptRequest: (req: ContactRequest) => Promise<boolean>;
  rejectRequest: (req: ContactRequest) => Promise<boolean>;
  cancelRequest: (req: ContactRequest) => Promise<boolean>;
  deleteContact: (contactId: string) => Promise<boolean>;
  blockContact: (contactId: string) => Promise<boolean>;
  unblockContact: (contactId: string) => Promise<boolean>;
  blockedUsers: string[];
  createGroup: (name: string, memberIds: string[]) => Promise<GroupItem | null>;
  sendMessage: (content: string) => Promise<LocalMessage | null>;
  sendFile: (file: File) => Promise<LocalMessage | null>;
  sendTyping: (isTyping: boolean) => void;
  retryPeerConnection: (peerUserId: string) => Promise<void>;
  
  // Calls
  startCall: (callType: 'voice' | 'video') => Promise<void>;
  acceptCall: (callType?: 'voice' | 'video') => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => boolean;
  toggleVideo: () => boolean;
  flipCamera: () => Promise<boolean>;
  toggleScreenShare: () => Promise<boolean>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [contactRequests, setContactRequests] = useState<{ incoming: ContactRequest[]; outgoing: ContactRequest[] }>({
    incoming: [],
    outgoing: []
  });
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [peerStatuses, setPeerStatuses] = useState<Record<string, PeerConnectionStatus>>({});
  const [peerErrors, setPeerErrors] = useState<Record<string, string>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  // Calling
  const [activeCall, setActiveCall] = useState<ActiveCallState>(peerManager.getActiveCall());
  const activeCallRef = useRef<ActiveCallState>(activeCall);
  activeCallRef.current = activeCall;
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // --------------------------------------------------------------------------
  // Data Loaders
  // --------------------------------------------------------------------------
  const refreshBlockedUsers = useCallback(async () => {
    const list = await localDb.getBlockedUsers();
    setBlockedUsers(list);
  }, []);

  const refreshContacts = useCallback(async () => {
    if (!currentUser) return;
    const items = await supabaseService.fetchContacts(currentUser.id);
    const blockedList = await localDb.getBlockedUsers();
    // Filter out any contacts that have been blocked
    setContacts(items.filter(c => !blockedList.includes(c.contact_id)));
  }, [currentUser]);

  const refreshRequests = useCallback(async () => {
    if (!currentUser) return;
    const reqs = await supabaseService.fetchContactRequests(currentUser.id);
    setContactRequests(reqs);
  }, [currentUser]);

  const refreshGroups = useCallback(async () => {
    if (!currentUser) return;
    const grps = await supabaseService.fetchMyGroups(currentUser.id);
    setGroups(grps);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      refreshBlockedUsers();
      refreshContacts();
      refreshRequests();
      refreshGroups();

      // Keep contacts and incoming/outgoing requests continuously synchronized
      const syncInterval = setInterval(() => {
        refreshContacts();
        refreshRequests();
      }, 2500);

      return () => clearInterval(syncInterval);
    }
  }, [currentUser, refreshContacts, refreshRequests, refreshGroups]);

  const selectedChatRef = useRef<SelectedChat | null>(null);
  selectedChatRef.current = selectedChat;

  // --------------------------------------------------------------------------
  // Realtime Presence & WebRTC Event Bindings
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;

    // Presence updates
    const unbindPresence = signalingService.onPresenceChange((onlineSet) => {
      setOnlineUsers(new Set(onlineSet));

      // Auto-reconnect if current open direct chat contact just appeared online
      if (selectedChatRef.current?.type === 'direct') {
        const activePeerId = selectedChatRef.current.id;
        if (onlineSet.has(activePeerId)) {
          const status = peerManager.getPeerStatus(activePeerId);
          if (status !== 'connected' && status !== 'connecting' && status !== 'signaling') {
            console.log(`[Presence] Active peer ${activePeerId} came online, establishing P2P WebRTC...`);
            peerManager.connectToPeer(activePeerId).catch(console.warn);
          }
        }
      }
    });

    // P2P Status updates
    const unbindStatus = peerManager.onPeerStatusChange((peerId, status, errorReason) => {
      setPeerStatuses(prev => ({ ...prev, [peerId]: status }));
      if (errorReason) {
        setPeerErrors(prev => ({ ...prev, [peerId]: errorReason }));
      }
    });

    // Typing indicators
    const unbindTyping = peerManager.onTypingChange((peerId, isTyping) => {
      setTypingUsers(prev => ({ ...prev, [peerId]: isTyping }));
    });

    // Call state updates
    const unbindCall = peerManager.onCallStateChange((state) => {
      activeCallRef.current = state;
      setActiveCall(state);
      setLocalStream(peerManager.getLocalMediaStream());
      if (state.remoteUserId) {
        const stream = peerManager.getRemoteMediaStream(state.remoteUserId);
        setRemoteStream(stream ? new MediaStream(stream.getTracks()) : null);
      } else {
        setRemoteStream(null);
      }
    });

    // Remote stream updates
    const unbindStream = peerManager.onRemoteStream((peerId, stream) => {
      if (activeCallRef.current.remoteUserId === peerId || !activeCallRef.current.remoteUserId) {
        setRemoteStream(new MediaStream(stream.getTracks()));
      }
    });

    // Auto-reconnect on visibility change or network return
    const handleVisibilityOrOnline = () => {
      if (document.visibilityState === 'visible' && selectedChatRef.current?.type === 'direct') {
        const contactId = selectedChatRef.current.id;
        const status = peerManager.getPeerStatus(contactId);
        if (status === 'disconnected' || status === 'failed') {
          console.log('[WebRTC] App restored to foreground/online, retrying connection to:', contactId);
          peerManager.retryPeerConnection(contactId).catch(console.warn);
        }
      }
    };

    window.addEventListener('online', handleVisibilityOrOnline);
    document.addEventListener('visibilitychange', handleVisibilityOrOnline);

    return () => {
      unbindPresence();
      unbindStatus();
      unbindTyping();
      unbindCall();
      unbindStream();
      window.removeEventListener('online', handleVisibilityOrOnline);
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
    };
  }, [currentUser, activeCall.remoteUserId]);

  // --------------------------------------------------------------------------
  // Chat Selection
  // --------------------------------------------------------------------------
  const selectDirectChat = useCallback((contact: ContactItem) => {
    setSelectedChat({
      type: 'direct',
      id: contact.contact_id,
      name: contact.profile.display_name,
      profile: contact.profile
    });

    localDb.resetUnreadCount(contact.contact_id);

    // Auto-establish direct P2P connection immediately
    if (currentUser) {
      peerManager.connectToPeer(contact.contact_id).catch(err => {
        console.warn('Initial P2P connection attempt:', err);
      });
    }
  }, [currentUser]);

  const selectGroupChat = useCallback((group: GroupItem) => {
    setSelectedChat({
      type: 'group',
      id: group.id,
      name: group.name,
      group
    });

    localDb.resetUnreadCount(group.id);

    // Join P2P mesh
    groupMeshManager.joinGroupMesh(group).catch(console.error);
  }, []);

  const closeChat = useCallback(() => {
    setSelectedChat(null);
  }, []);

  // --------------------------------------------------------------------------
  // Message & File Actions
  // --------------------------------------------------------------------------
  const sendMessage = useCallback(async (content: string): Promise<LocalMessage | null> => {
    if (!selectedChat) return null;

    if (selectedChat.type === 'direct') {
      return await peerManager.sendMessage(selectedChat.id, content);
    } else {
      return await groupMeshManager.sendGroupMessage(selectedChat.id, content);
    }
  }, [selectedChat]);

  const sendFile = useCallback(async (file: File): Promise<LocalMessage | null> => {
    if (!selectedChat) return null;

    if (selectedChat.type === 'direct') {
      return await peerManager.sendFile(selectedChat.id, file);
    } else {
      return await groupMeshManager.sendGroupFile(selectedChat.id, file);
    }
  }, [selectedChat]);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (selectedChat && selectedChat.type === 'direct') {
      peerManager.sendTypingIndicator(selectedChat.id, isTyping);
    }
  }, [selectedChat]);

  const retryPeerConnection = useCallback(async (peerUserId: string) => {
    await peerManager.retryPeerConnection(peerUserId);
  }, []);

  // --------------------------------------------------------------------------
  // Contact Actions
  // --------------------------------------------------------------------------
  const sendContactRequestByPublicId = useCallback(async (publicId: string) => {
    if (!currentUser) return { success: false, error: 'Not authenticated' };

    const targetProfile = await supabaseService.getProfileByPublicId(publicId);
    if (!targetProfile) {
      return { success: false, error: 'No user found with public ID: ' + publicId };
    }

    const result = await supabaseService.sendContactRequest(currentUser.id, targetProfile.id);
    await refreshContacts();
    await refreshRequests();
    return { ...result, targetProfile };
  }, [currentUser, refreshContacts, refreshRequests]);

  const acceptRequest = useCallback(async (req: ContactRequest): Promise<boolean> => {
    const ok = await supabaseService.acceptContactRequest(req.id, req.sender_id, req.receiver_id);
    if (ok) {
      await refreshContacts();
      await refreshRequests();
    }
    return ok;
  }, [refreshContacts, refreshRequests]);

  const rejectRequest = useCallback(async (req: ContactRequest): Promise<boolean> => {
    const ok = await supabaseService.rejectContactRequest(req.id);
    if (ok) {
      await refreshRequests();
    }
    return ok;
  }, [refreshRequests]);

  const cancelRequest = useCallback(async (req: ContactRequest): Promise<boolean> => {
    const ok = await supabaseService.cancelContactRequest(req.id);
    if (ok) {
      await refreshRequests();
    }
    return ok;
  }, [refreshRequests]);

  const deleteContact = useCallback(async (contactId: string): Promise<boolean> => {
    if (!currentUser) return false;
    // 1. Optimistically remove from UI contacts list immediately
    setContacts(prev => prev.filter(c => c.contact_id !== contactId));
    if (selectedChat?.id === contactId) {
      setSelectedChat(null);
    }
    // 2. Terminate active WebRTC connection
    peerManager.closePeerSession(contactId);
    // 3. Delete local conversation summary
    await localDb.deleteConversation(contactId);
    // 4. Remove from server contacts and requests
    const ok = await supabaseService.removeContact(currentUser.id, contactId);
    await refreshContacts();
    return ok;
  }, [currentUser, selectedChat, refreshContacts]);

  const blockContact = useCallback(async (contactId: string): Promise<boolean> => {
    if (!currentUser) return false;
    // 1. Save to local block list in IndexedDB
    await localDb.blockUser(contactId);
    // 2. Optimistically remove from UI contacts list immediately
    setContacts(prev => prev.filter(c => c.contact_id !== contactId));
    if (selectedChat?.id === contactId) {
      setSelectedChat(null);
    }
    // 3. Terminate active WebRTC connection immediately
    peerManager.closePeerSession(contactId);
    // 4. Delete local conversation summary
    await localDb.deleteConversation(contactId);
    // 5. Remove from server contacts and requests
    await supabaseService.removeContact(currentUser.id, contactId);
    // 6. Refresh blocked users and contacts
    await refreshBlockedUsers();
    await refreshContacts();
    return true;
  }, [currentUser, selectedChat, refreshBlockedUsers, refreshContacts]);

  const unblockContact = useCallback(async (contactId: string): Promise<boolean> => {
    if (currentUser) {
      await supabaseService.unblockContact(currentUser.id, contactId);
    }
    await localDb.unblockUser(contactId);
    await refreshBlockedUsers();
    await refreshContacts();
    return true;
  }, [currentUser, refreshBlockedUsers, refreshContacts]);

  const createGroup = useCallback(async (name: string, memberIds: string[]): Promise<GroupItem | null> => {
    if (!currentUser) return null;
    const grp = await supabaseService.createGroup(currentUser.id, name, memberIds);
    if (grp) {
      await refreshGroups();
      selectGroupChat(grp);
    }
    return grp;
  }, [currentUser, refreshGroups, selectGroupChat]);

  // --------------------------------------------------------------------------
  // Calls
  // --------------------------------------------------------------------------
  const startCall = useCallback(async (callType: 'voice' | 'video') => {
    if (!selectedChat || selectedChat.type !== 'direct') return;
    await peerManager.startCall(selectedChat.id, callType, selectedChat.name);
  }, [selectedChat]);

  const acceptCall = useCallback(async (callType?: 'voice' | 'video') => {
    await peerManager.acceptCall(callType);
  }, []);

  const rejectCall = useCallback(() => {
    peerManager.rejectCall();
  }, []);

  const endCall = useCallback(() => {
    peerManager.endCall();
  }, []);

  const toggleMute = useCallback(() => {
    return peerManager.toggleMute();
  }, []);

  const toggleVideo = useCallback(() => {
    return peerManager.toggleVideo();
  }, []);

  const flipCamera = useCallback(async () => {
    return await peerManager.flipCamera();
  }, []);

  const toggleScreenShare = useCallback(async () => {
    return await peerManager.toggleScreenShare();
  }, []);

  return (
    <ChatContext.Provider value={{
      contacts,
      contactRequests,
      groups,
      selectedChat,
      onlineUsers,
      peerStatuses,
      peerErrors,
      typingUsers,
      activeCall,
      localStream,
      remoteStream,
      selectDirectChat,
      selectGroupChat,
      closeChat,
      refreshContacts,
      refreshRequests,
      refreshGroups,
      sendContactRequestByPublicId,
      acceptRequest,
      rejectRequest,
      cancelRequest,
      deleteContact,
      blockContact,
      unblockContact,
      blockedUsers,
      createGroup,
      sendMessage,
      sendFile,
      sendTyping,
      retryPeerConnection,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleVideo,
      flipCamera,
      toggleScreenShare
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
