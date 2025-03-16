-- Fix Row Level Security policies for the items table
-- Run this in the Supabase SQL Editor

-- First, check if RLS is enabled on the items table
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'items';

-- Enable Row Level Security on the items table if not already enabled
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might be causing issues
DROP POLICY IF EXISTS "Allow admin full access" ON public.items;
DROP POLICY IF EXISTS "Allow read access to all" ON public.items;
DROP POLICY IF EXISTS "Allow admins to insert/update" ON public.items;

-- Create policies to allow proper access

-- Policy to allow admins full access to items
CREATE POLICY "Allow admin full access" ON public.items
    FOR ALL
    USING (
        is_admin()
    )
    WITH CHECK (
        is_admin()
    );

-- Policy to allow everyone to read items
CREATE POLICY "Allow read access to all" ON public.items
    FOR SELECT
    USING (true);

-- If the is_admin function doesn't exist, create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'is_admin' 
        AND prokind = 'f'
    ) THEN
        EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
        RETURNS BOOLEAN AS $$
        BEGIN
            RETURN EXISTS (
                SELECT 1 FROM public.admins
                WHERE id = COALESCE(user_id, auth.uid())
            );
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        $func$;
    END IF;
END
$$; 