// ============================================================================
// Core Type Definitions for P2P Privacy-Focused Messaging PWA
// ============================================================================

export type PresenceState = 'online' | 'offline' | 'connecting' | 'connected';

export type PeerConnectionStatus = 
  | 'idle' 
  | 'signaling' 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'failed';

export interface UserProfile {
  id: string;
  public_id: string;
  display_name: string;
  created_at: string;
  updated_at?: string;
  avatar_data?: string; // Local storage / P2P exchange only; NEVER on cloud
}

export interface PublicKeyRecord {
  user_id: string;
  public_key: string; // Exported JWK format
  key_version: number;
  created_at: string;
}

export interface ContactRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
  created_at: string;
  updated_at: string;
  sender_profile?: UserProfile;
  receiver_profile?: UserProfile;
}

export interface ContactItem {
  id: string;
  user_id: string;
  contact_id: string;
  created_at: string;
  profile: UserProfile;
  presence: PresenceState;
  connectionStatus: PeerConnectionStatus;
  lastSeen?: number;
}

export interface GroupItem {
  id: string;
  name: string;
  creator_id: string;
  created_at: string;
  members: GroupMemberItem[];
}

export interface GroupMemberItem {
  id: string;
  group_id: string;
  user_id: string;
  role: 'host' | 'member';
  status: 'pending' | 'accepted' | 'rejected' | 'left';
  profile?: UserProfile;
  presence?: PresenceState;
  connectionStatus?: PeerConnectionStatus;
}

// ----------------------------------------------------------------------------
// Local Storage (IndexedDB / Dexie.js) Types
// ----------------------------------------------------------------------------
export type MessageType = 'text' | 'file' | 'system' | 'call_log';
export type MessageStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'failed';

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  dataBlob?: Blob;
  blobUrl?: string;
}

export interface CallLogMetadata {
  callType: 'voice' | 'video';
  status: 'completed' | 'missed' | 'rejected';
  durationSeconds?: number;
}

export interface LocalMessage {
  id: string;
  conversationId: string; // recipient user_id or group_id
  senderId: string;
  senderName: string;
  type: MessageType;
  content: string; // Plain text or file caption
  fileMetadata?: FileMetadata;
  callMetadata?: CallLogMetadata;
  status: MessageStatus;
  timestamp: number;
  isE2EE: boolean;
}

export interface LocalConversation {
  id: string; // contactId or groupId
  type: 'direct' | 'group';
  displayName: string;
  lastMessageText: string;
  lastMessageTimestamp: number;
  unreadCount: number;
}

export interface CachedPeerData {
  userId: string;
  avatarBase64?: string;
  publicKeyJWK?: string;
  cachedAt: number;
}

export interface DeviceKeypairRecord {
  id: string; // 'current_user_keypair'
  publicKeyJWK: string;
  privateKeyJWK: string;
  createdAt: number;
}

// ----------------------------------------------------------------------------
// WebRTC Signaling & Ephemeral Channel Payloads
// ----------------------------------------------------------------------------
export type SignalingSignalType = 
  | 'offer' 
  | 'answer' 
  | 'ice-candidate' 
  | 'connect-ping'
  | 'call-invite' 
  | 'call-accept' 
  | 'call-reject' 
  | 'call-end'
  | 'mesh-member-joined'
  | 'mesh-member-left';

export interface SignalingPayload {
  type: SignalingSignalType;
  senderId: string;
  targetId: string;
  sessionId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  callType?: 'voice' | 'video';
  meshGroupId?: string;
  timestamp: number;
}

// ----------------------------------------------------------------------------
// WebRTC DataChannel Wire Protocol (Direct Peer-to-Peer over RTCDataChannel)
// ----------------------------------------------------------------------------
export type DataChannelPacketType = 
  | 'CHAT_MESSAGE'
  | 'MESSAGE_ACK'
  | 'TYPING'
  | 'KEY_EXCHANGE'
  | 'FILE_START'
  | 'FILE_CHUNK'
  | 'FILE_END'
  | 'FILE_CANCEL'
  | 'AVATAR_SYNC';

export interface WirePacket {
  type: DataChannelPacketType;
  id: string;
  senderId: string;
  timestamp: number;
  ackMessageId?: string; // For MESSAGE_ACK
  sha256Hash?: string;   // For FILE_END verification
  // Encrypted payload fields (AES-GCM):
  ciphertext?: string; // base64
  iv?: string;         // base64 12-byte IV
  publicKeyJWK?: string; // For instant in-band key exchange and synchronization
  // Cleartext metadata fields for control packets:
  fileMeta?: {
    fileId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    totalChunks: number;
  };
  chunkMeta?: {
    fileId: string;
    chunkIndex: number;
    totalChunks: number;
  };
  isTyping?: boolean;
}

export interface ActiveCallState {
  active: boolean;
  callType: 'voice' | 'video';
  isIncoming: boolean;
  remoteUserId: string;
  remoteUserName: string;
  groupId?: string;
  isMeshGroup?: boolean;
  status: 'initiating' | 'ringing' | 'connected' | 'reconnecting' | 'ended';
  startedAt?: number;
  isMuted: boolean;
  isVideoOff: boolean;
}
