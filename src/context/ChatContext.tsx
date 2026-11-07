import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  sendContactRequestByPublicId: (publicId: string) => Promise<{ success: boolean; error?: string }>;
  acceptRequest: (req: ContactRequest) => Promise<boolean>;
  rejectRequest: (req: ContactRequest) => Promise<boolean>;
  deleteContact: (contactId: string) => Promise<boolean>;
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

  // Calling
  const [activeCall, setActiveCall] = useState<ActiveCallState>(peerManager.getActiveCall());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // --------------------------------------------------------------------------
  // Data Loaders
  // --------------------------------------------------------------------------
  const refreshContacts = useCallback(async () => {
    if (!currentUser) return;
    const items = await supabaseService.fetchContacts(currentUser.id);
    setContacts(items);
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
      refreshContacts();
      refreshRequests();
      refreshGroups();
    }
  }, [currentUser, refreshContacts, refreshRequests, refreshGroups]);

  // --------------------------------------------------------------------------
  // Realtime Presence & WebRTC Event Bindings
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;

    // Presence updates
    const unbindPresence = signalingService.onPresenceChange((onlineSet) => {
      setOnlineUsers(new Set(onlineSet));
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
      setActiveCall(state);
      setLocalStream(peerManager.getLocalMediaStream());
      if (state.remoteUserId) {
        setRemoteStream(peerManager.getRemoteMediaStream(state.remoteUserId) || null);
      } else {
        setRemoteStream(null);
      }
    });

    // Remote stream updates
    const unbindStream = peerManager.onRemoteStream((peerId, stream) => {
      if (activeCall.remoteUserId === peerId) {
        setRemoteStream(stream);
      }
    });

    return () => {
      unbindPresence();
      unbindStatus();
      unbindTyping();
      unbindCall();
      unbindStream();
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

    // Auto-establish direct P2P connection if online
    if (signalingService.isUserOnline(contact.contact_id)) {
      peerManager.connectToPeer(contact.contact_id).catch(err => {
        console.warn('Initial P2P connection attempt:', err);
      });
    }
  }, []);

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
    await peerManager.connectToPeer(peerUserId);
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
    if (result.success) {
      refreshRequests();
    }
    return result;
  }, [currentUser, refreshRequests]);

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

  const deleteContact = useCallback(async (contactId: string): Promise<boolean> => {
    if (!currentUser) return false;
    const ok = await supabaseService.removeContact(currentUser.id, contactId);
    if (ok) {
      if (selectedChat?.id === contactId) {
        setSelectedChat(null);
      }
      peerManager.closePeerSession(contactId);
      await refreshContacts();
    }
    return ok;
  }, [currentUser, selectedChat, refreshContacts]);

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
      deleteContact,
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
      toggleVideo
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
