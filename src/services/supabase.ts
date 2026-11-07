import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { 
  UserProfile, 
  ContactItem, 
  ContactRequest, 
  GroupItem 
} from '@/types';
import { localDb } from './db';

// ============================================================================
// Supabase Client & Backend Services
// RESPONSIBILITIES:
// - Google Auth
// - User Profiles (Public ID, Display Name - ZERO Email exposure)
// - Public Keys (ECDH)
// - Contact Relationships & Requests
// - Group Membership Metadata
// - Ephemeral Realtime Signaling & Presence
//
// STRICT EXCLUSIONS:
// - ZERO message tables or chat storage
// - ZERO media or file storage buckets
// - ZERO server-side message forwarding
// ============================================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Detect if real credentials are provided or if running in mock/demo sandbox
export const isConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('sample-p2p-project') &&
  !supabaseAnonKey.includes('placeholder')
);

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://sample-p2p-project.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 20
      }
    }
  }
);

class SupabaseService {
  private activeChannels: Map<string, RealtimeChannel> = new Map();

  // --------------------------------------------------------------------------
  // Authentication (Google OAuth & Mock/Dev Support)
  // --------------------------------------------------------------------------
  async signInWithGoogle(): Promise<{ error: Error | null }> {
    if (!isConfigured) {
      // In demo/dev mode without real Supabase project configured, create local demo session
      const demoUser = this.getMockDemoUser();
      localStorage.setItem('p2p_demo_user', JSON.stringify(demoUser));
      window.location.reload();
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      return { error: error ? new Error(error.message) : null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error('Google Sign-In failed') };
    }
  }

  async signInAsTestPeer(name?: string): Promise<{ error: Error | null }> {
    if (!isConfigured) {
      const randSuffix = Math.random().toString(36).substring(2, 8);
      const user: UserProfile = {
        id: 'demo-user-' + randSuffix,
        public_id: 'p2p_' + randSuffix,
        display_name: name || ('Peer ' + randSuffix.toUpperCase()),
        created_at: new Date().toISOString()
      };
      localStorage.setItem('p2p_demo_user', JSON.stringify(user));
      window.location.reload();
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        const randId = Math.random().toString(36).substring(2, 10);
        const testEmail = `peer_${randId}@p2p.internal`;
        const testPassword = 'P2P_Shield_' + randId;
        const res = await supabase.auth.signUp({
          email: testEmail,
          password: testPassword,
          options: {
            data: {
              full_name: name || ('Peer ' + randId.substring(0, 4).toUpperCase())
            }
          }
        });
        if (res.error) {
          return { error: new Error(res.error.message) };
        }
      }
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error('Test sign-in failed') };
    }
  }

  async signOut(): Promise<void> {
    localStorage.removeItem('p2p_demo_user');
    if (isConfigured) {
      await supabase.auth.signOut();
    }
    // Clean up active realtime channels
    this.cleanupAllChannels();
  }

  async getCurrentSessionUser(): Promise<UserProfile | null> {
    if (!isConfigured) {
      const stored = localStorage.getItem('p2p_demo_user');
      if (stored) {
        return JSON.parse(stored) as UserProfile;
      }
      return null;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    // Fetch or initialize profile
    const profile = await this.getProfile(session.user.id);
    if (profile) return profile;

    // If profile row doesn't exist yet, create it
    const newPublicId = 'p2p_' + Math.random().toString(36).substring(2, 12);
    const displayName = session.user.user_metadata?.full_name || 
                        session.user.user_metadata?.name || 
                        'Peer_' + newPublicId.substring(4, 8);

    const { data: created, error } = await supabase
      .from('profiles')
      .insert({
        id: session.user.id,
        public_id: newPublicId,
        display_name: displayName
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user profile:', error);
      return null;
    }

    return created as UserProfile;
  }

  // --------------------------------------------------------------------------
  // Profiles
  // --------------------------------------------------------------------------
  async getProfile(userId: string): Promise<UserProfile | null> {
    if (!isConfigured) {
      const demoUser = this.getMockDemoUser();
      if (demoUser.id === userId) return demoUser;
      const cached = await localDb.getCachedPeer(userId);
      if (cached) {
        return {
          id: userId,
          public_id: 'p2p_demo_' + userId.substring(0, 6),
          display_name: 'Contact ' + userId.substring(0, 4),
          created_at: new Date(cached.cachedAt).toISOString(),
          avatar_data: cached.avatarBase64
        };
      }
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, public_id, display_name, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching profile:', error);
      return null;
    }

    return data as UserProfile | null;
  }

  async getProfileByPublicId(publicId: string): Promise<UserProfile | null> {
    if (!isConfigured) {
      // Mock lookup
      if (publicId === 'p2p_demo_alice') {
        return {
          id: 'demo-user-alice',
          public_id: 'p2p_demo_alice',
          display_name: 'Alice (Demo Peer)',
          created_at: new Date().toISOString()
        };
      }
      if (publicId === 'p2p_demo_bob') {
        return {
          id: 'demo-user-bob',
          public_id: 'p2p_demo_bob',
          display_name: 'Bob (Demo Peer)',
          created_at: new Date().toISOString()
        };
      }
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, public_id, display_name, created_at')
      .eq('public_id', publicId.trim())
      .maybeSingle();

    if (error || !data) return null;
    return data as UserProfile;
  }

  async updateDisplayName(userId: string, newName: string): Promise<boolean> {
    if (!isConfigured) {
      const demoUser = this.getMockDemoUser();
      demoUser.display_name = newName;
      localStorage.setItem('p2p_demo_user', JSON.stringify(demoUser));
      return true;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: newName, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return !error;
  }

  // --------------------------------------------------------------------------
  // Public Keys (Application E2EE)
  // --------------------------------------------------------------------------
  async publishPublicKey(userId: string, publicKeyJWK: string): Promise<boolean> {
    if (!isConfigured) return true;

    const { error } = await supabase
      .from('public_keys')
      .upsert({
        user_id: userId,
        public_key: publicKeyJWK,
        key_version: 1,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    return !error;
  }

  async getPeerPublicKey(userId: string): Promise<string | null> {
    if (!isConfigured) {
      // Return a generated JWK or fallback for demo
      return null;
    }

    const { data, error } = await supabase
      .from('public_keys')
      .select('public_key')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return data.public_key;
  }

  // --------------------------------------------------------------------------
  // Contacts & Requests
  // --------------------------------------------------------------------------
  async fetchContacts(currentUserId: string): Promise<ContactItem[]> {
    if (!isConfigured) {
      const raw = localStorage.getItem('p2p_demo_contacts');
      return raw ? JSON.parse(raw) : this.getDefaultDemoContacts();
    }

    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        user_id,
        contact_id,
        created_at,
        contact_profile:profiles!contacts_contact_id_fkey(id, public_id, display_name, created_at)
      `)
      .eq('user_id', currentUserId);

    if (error) {
      console.error('Error fetching contacts:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      contact_id: row.contact_id,
      created_at: row.created_at,
      profile: row.contact_profile as UserProfile,
      presence: 'offline',
      connectionStatus: 'idle'
    }));
  }

  async fetchContactRequests(currentUserId: string): Promise<{
    incoming: ContactRequest[];
    outgoing: ContactRequest[];
  }> {
    if (!isConfigured) {
      const raw = localStorage.getItem('p2p_demo_requests');
      const all: ContactRequest[] = raw ? JSON.parse(raw) : [];
      return {
        incoming: all.filter(r => r.receiver_id === currentUserId && r.status === 'pending'),
        outgoing: all.filter(r => r.sender_id === currentUserId && r.status === 'pending')
      };
    }

    const { data, error } = await supabase
      .from('contact_requests')
      .select(`
        id,
        sender_id,
        receiver_id,
        status,
        created_at,
        updated_at,
        sender_profile:profiles!contact_requests_sender_id_fkey(id, public_id, display_name, created_at),
        receiver_profile:profiles!contact_requests_receiver_id_fkey(id, public_id, display_name, created_at)
      `)
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching contact requests:', error);
      return { incoming: [], outgoing: [] };
    }

    const incoming: ContactRequest[] = [];
    const outgoing: ContactRequest[] = [];

    for (const req of (data || [])) {
      const item: ContactRequest = {
        id: req.id,
        sender_id: req.sender_id,
        receiver_id: req.receiver_id,
        status: req.status,
        created_at: req.created_at,
        updated_at: req.updated_at,
        sender_profile: (req as any).sender_profile,
        receiver_profile: (req as any).receiver_profile
      };

      if (req.receiver_id === currentUserId) {
        incoming.push(item);
      } else {
        outgoing.push(item);
      }
    }

    return { incoming, outgoing };
  }

  async sendContactRequest(senderId: string, receiverId: string): Promise<{ success: boolean; error?: string }> {
    if (senderId === receiverId) {
      return { success: false, error: 'Cannot add yourself as a contact' };
    }

    if (!isConfigured) {
      // Simulate demo request
      return { success: true };
    }

    // Check if already contacts
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', senderId)
      .eq('contact_id', receiverId)
      .maybeSingle();

    if (existingContact) {
      return { success: false, error: 'User is already in your contacts' };
    }

    const { error } = await supabase
      .from('contact_requests')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        status: 'pending'
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Contact request already sent or pending' };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  async acceptContactRequest(requestId: string, senderId: string, receiverId: string): Promise<boolean> {
    if (!isConfigured) return true;

    // 1. Update request status
    const { error: updateError } = await supabase
      .from('contact_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (updateError) return false;

    // 2. Insert bidirectional contacts
    await supabase.from('contacts').upsert([
      { user_id: senderId, contact_id: receiverId },
      { user_id: receiverId, contact_id: senderId }
    ], { onConflict: 'user_id,contact_id' });

    return true;
  }

  async rejectContactRequest(requestId: string): Promise<boolean> {
    if (!isConfigured) return true;

    const { error } = await supabase
      .from('contact_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    return !error;
  }

  async removeContact(userId: string, contactId: string): Promise<boolean> {
    if (!isConfigured) return true;

    const { error } = await supabase
      .from('contacts')
      .delete()
      .or(`and(user_id.eq.${userId},contact_id.eq.${contactId}),and(user_id.eq.${contactId},contact_id.eq.${userId})`);

    return !error;
  }

  // --------------------------------------------------------------------------
  // Groups (Mesh coordination metadata only)
  // --------------------------------------------------------------------------
  async createGroup(creatorId: string, name: string, memberIds: string[]): Promise<GroupItem | null> {
    if (!isConfigured) {
      const newGroup: GroupItem = {
        id: 'group_' + Math.random().toString(36).substring(2, 9),
        name,
        creator_id: creatorId,
        created_at: new Date().toISOString(),
        members: [
          {
            id: 'm_' + Math.random(),
            group_id: 'group_demo',
            user_id: creatorId,
            role: 'host',
            status: 'accepted'
          }
        ]
      };
      return newGroup;
    }

    // 1. Create group
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .insert({ name, creator_id: creatorId })
      .select()
      .single();

    if (groupError || !groupData) return null;

    // 2. Add creator as host
    const membersToInsert = [
      { group_id: groupData.id, user_id: creatorId, role: 'host', status: 'accepted' },
      ...memberIds.map(uid => ({
        group_id: groupData.id,
        user_id: uid,
        role: 'member',
        status: 'accepted'
      }))
    ];

    await supabase.from('group_members').insert(membersToInsert);

    return this.fetchGroupDetails(groupData.id);
  }

  async fetchMyGroups(userId: string): Promise<GroupItem[]> {
    if (!isConfigured) return [];

    const { data: memberRows, error } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    if (error || !memberRows) return [];

    const groupIds = memberRows.map(r => r.group_id);
    if (groupIds.length === 0) return [];

    const groups: GroupItem[] = [];
    for (const gid of groupIds) {
      const details = await this.fetchGroupDetails(gid);
      if (details) groups.push(details);
    }

    return groups;
  }

  async fetchGroupDetails(groupId: string): Promise<GroupItem | null> {
    const { data: group, error: groupErr } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupErr || !group) return null;

    const { data: members, error: memErr } = await supabase
      .from('group_members')
      .select(`
        id,
        group_id,
        user_id,
        role,
        status,
        profile:profiles!group_members_user_id_fkey(id, public_id, display_name, created_at)
      `)
      .eq('group_id', groupId);

    if (memErr) return null;

    return {
      id: group.id,
      name: group.name,
      creator_id: group.creator_id,
      created_at: group.created_at,
      members: (members || []).map((m: any) => ({
        id: m.id,
        group_id: m.group_id,
        user_id: m.user_id,
        role: m.role,
        status: m.status,
        profile: m.profile as UserProfile,
        presence: 'offline',
        connectionStatus: 'idle'
      }))
    };
  }

  // --------------------------------------------------------------------------
  // Realtime Broadcast & Ephemeral Signaling Channels
  // --------------------------------------------------------------------------
  getOrCreateChannel(channelName: string): RealtimeChannel {
    let channel = this.activeChannels.get(channelName);
    if (!channel) {
      channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: '' }
        }
      });
      this.activeChannels.set(channelName, channel);
    }
    return channel;
  }

  removeChannel(channelName: string): void {
    const channel = this.activeChannels.get(channelName);
    if (channel) {
      supabase.removeChannel(channel);
      this.activeChannels.delete(channelName);
    }
  }

  cleanupAllChannels(): void {
    for (const [_, channel] of this.activeChannels) {
      supabase.removeChannel(channel);
    }
    this.activeChannels.clear();
  }

  // --------------------------------------------------------------------------
  // Mock/Sandbox helpers (for instant testing prior to user's env configuration)
  // --------------------------------------------------------------------------
  private getMockDemoUser(): UserProfile {
    const stored = localStorage.getItem('p2p_demo_user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (_) {}
    }
    const randSuffix = Math.random().toString(36).substring(2, 8);
    const user: UserProfile = {
      id: 'demo-user-' + randSuffix,
      public_id: 'p2p_' + randSuffix,
      display_name: 'Peer ' + randSuffix.toUpperCase(),
      created_at: new Date().toISOString()
    };
    localStorage.setItem('p2p_demo_user', JSON.stringify(user));
    return user;
  }

  private getDefaultDemoContacts(): ContactItem[] {
    return [
      {
        id: 'c-demo-alice',
        user_id: 'demo-local-user',
        contact_id: 'demo-user-alice',
        created_at: new Date().toISOString(),
        profile: {
          id: 'demo-user-alice',
          public_id: 'p2p_demo_alice',
          display_name: 'Alice (Demo Contact)',
          created_at: new Date().toISOString()
        },
        presence: 'online',
        connectionStatus: 'idle'
      },
      {
        id: 'c-demo-bob',
        user_id: 'demo-local-user',
        contact_id: 'demo-user-bob',
        created_at: new Date().toISOString(),
        profile: {
          id: 'demo-user-bob',
          public_id: 'p2p_demo_bob',
          display_name: 'Bob (Demo Contact)',
          created_at: new Date().toISOString()
        },
        presence: 'offline',
        connectionStatus: 'idle'
      }
    ];
  }
}

export const supabaseService = new SupabaseService();
