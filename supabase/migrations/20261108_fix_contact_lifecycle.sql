-- ============================================================================
-- Migration: Fix Contact Lifecycle, Deletion, and Re-Adding
-- Allows clean contact removal, bi-directional cleanup, and re-requesting.
-- ============================================================================

-- 1. Grant Authenticated Users permission to DELETE their contact requests
DROP POLICY IF EXISTS "Users can delete requests concerning them" ON public.contact_requests;
CREATE POLICY "Users can delete requests concerning them"
    ON public.contact_requests
    FOR DELETE
    TO authenticated
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 2. Grant Authenticated Users permission to DELETE contact records where they are user or contact
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts concerning them" ON public.contacts;
CREATE POLICY "Users can delete contacts concerning them"
    ON public.contacts
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR auth.uid() = contact_id);

-- 3. Ensure contacts table has conflict handling trigger on update
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
