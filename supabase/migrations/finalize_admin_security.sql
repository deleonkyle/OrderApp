-- ⚠️ IMPORTANT: Run this migration only AFTER creating your first admin account ⚠️

-- Remove the permissive initial setup policy
DROP POLICY IF EXISTS "Initial setup policy" ON public.admins;

-- Now create proper security policies
-- Only admins can view admin records
CREATE POLICY "Admins can view admin records" ON public.admins
    FOR SELECT USING (
        is_admin()
    );

-- Admins can only update their own records
CREATE POLICY "Admins can update own record" ON public.admins
    FOR UPDATE USING (auth.uid() = id);

-- Allow inserts only by existing admins
CREATE POLICY "Allow admin inserts" ON public.admins
    FOR INSERT WITH CHECK (
        is_admin()
    );

-- Allow deletes only by admins (excluding self-deletion)
CREATE POLICY "Allow admin deletes" ON public.admins
    FOR DELETE USING (
        is_admin() AND auth.uid() != id
    ); 