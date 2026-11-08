-- ============================================================================
-- P2P Privacy-Focused Messaging Database Schema (Fully Idempotent & Safe)
-- Architecture Principle: "The server connects people; their devices communicate."
-- NO chat messages, media, or file storage tables are created.
-- ============================================================================

-- Enable pgcrypto for UUID and random token generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- ----------------------------------------------------------------------------
-- Stores public identity metadata only. 
-- Email addresses are strictly isolated in auth.users and NEVER exposed here.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    public_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast lookup by public_id (used when adding contacts / scanning QR codes)
CREATE INDEX IF NOT EXISTS idx_profiles_public_id ON public.profiles(public_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
DROP POLICY IF EXISTS "Public profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Public profiles are readable by authenticated users"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
CREATE POLICY "Users can create their own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 2. PUBLIC IDENTITY KEYS (For Application-Level E2EE)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.public_keys (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.public_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public keys are readable by authenticated users" ON public.public_keys;
CREATE POLICY "Public keys are readable by authenticated users"
    ON public.public_keys
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can insert their own public key" ON public.public_keys;
CREATE POLICY "Users can insert their own public key"
    ON public.public_keys
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own public key" ON public.public_keys;
CREATE POLICY "Users can update their own public key"
    ON public.public_keys
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. CONTACT REQUESTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'canceled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT no_self_requests CHECK (sender_id <> receiver_id),
    CONSTRAINT unique_pending_request UNIQUE (sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_requests_receiver ON public.contact_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_contact_requests_sender ON public.contact_requests(sender_id, status);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own contact requests" ON public.contact_requests;
CREATE POLICY "Users can view their own contact requests"
    ON public.contact_requests
    FOR SELECT
    TO authenticated
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send contact requests" ON public.contact_requests;
CREATE POLICY "Users can send contact requests"
    ON public.contact_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update requests concerning them" ON public.contact_requests;
CREATE POLICY "Users can update requests concerning them"
    ON public.contact_requests
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
    WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ----------------------------------------------------------------------------
-- 4. CONTACTS TABLE (Established bidirectional relationships)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT no_self_contact CHECK (user_id <> contact_id),
    CONSTRAINT unique_user_contact UNIQUE (user_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_id ON public.contacts(contact_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their contact relationships" ON public.contacts;
CREATE POLICY "Users can view their contact relationships"
    ON public.contacts FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.contacts;
CREATE POLICY "Users can insert their own contacts"
    ON public.contacts
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR auth.uid() = contact_id);

-- Trigger to automatically insert bidirectional contacts when request is accepted
CREATE OR REPLACE FUNCTION public.handle_contact_request_acceptance()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status = 'accepted' THEN
        INSERT INTO public.contacts (user_id, contact_id)
        VALUES 
            (NEW.sender_id, NEW.receiver_id),
            (NEW.receiver_id, NEW.sender_id)
        ON CONFLICT (user_id, contact_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_contact_request_accepted ON public.contact_requests;
CREATE TRIGGER on_contact_request_accepted
    AFTER UPDATE ON public.contact_requests
    FOR EACH ROW
    WHEN (NEW.status = 'accepted')
    EXECUTE FUNCTION public.handle_contact_request_acceptance();

DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;
CREATE POLICY "Users can delete their own contacts"
    ON public.contacts
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. GROUPS & GROUP MEMBERS (Mesh coordination metadata only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('host', 'member')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'left')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_group_membership UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view group metadata" ON public.groups;
CREATE POLICY "Group members can view group metadata"
    ON public.groups
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = public.groups.id
            AND gm.user_id = auth.uid()
        ) OR creator_id = auth.uid()
    );

DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
CREATE POLICY "Authenticated users can create groups"
    ON public.groups
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Group creator can update group" ON public.groups;
CREATE POLICY "Group creator can update group"
    ON public.groups
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Users can view memberships for groups they belong to" ON public.group_members;
CREATE POLICY "Users can view memberships for groups they belong to"
    ON public.group_members
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_members gm2
            WHERE gm2.group_id = public.group_members.group_id
            AND gm2.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Group creators or members can invite users" ON public.group_members;
CREATE POLICY "Group creators or members can invite users"
    ON public.group_members
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = group_id AND g.creator_id = auth.uid()
        ) OR user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Members can update their own status or host can manage" ON public.group_members;
CREATE POLICY "Members can update their own status or host can manage"
    ON public.group_members
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = group_id AND g.creator_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Members can leave or host can remove" ON public.group_members;
CREATE POLICY "Members can leave or host can remove"
    ON public.group_members
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = group_id AND g.creator_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- 6. AUTOMATIC PROFILE CREATION TRIGGER ON SIGNUP (Safe & Bulletproof)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, extensions
AS $$
DECLARE
    new_public_id TEXT;
    extracted_name TEXT;
BEGIN
    -- Use core md5 / random() to avoid any extension or search_path dependencies
    new_public_id := 'p2p_' || lower(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
    
    -- Extract display name from metadata or default to User_ID
    extracted_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        'Peer_' || substr(new_public_id, 5, 4)
    );

    INSERT INTO public.profiles (id, public_id, display_name)
    VALUES (NEW.id, new_public_id, extracted_name)
    ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Never abort auth.users creation if trigger encounters an issue
        RAISE WARNING 'handle_new_user error: %', SQLERRM;
        RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 7. ENABLE REALTIME SAFELY (Checks existing publication members)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contact_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_requests;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contacts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'group_members'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
    END IF;
END $$;
