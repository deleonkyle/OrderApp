-- Create admins table
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Set up Row Level Security (RLS) for the admins table
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Initially, allow all operations before we set the policies
CREATE POLICY "Initial setup policy" ON public.admins
    FOR ALL USING (true);

-- Create a function to check if the admins table is empty
CREATE OR REPLACE FUNCTION public.is_admins_empty()
RETURNS BOOLEAN AS $$
DECLARE
    admin_count integer;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM public.admins;
    RETURN admin_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user is an admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admins
        WHERE id = user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get current admin info
CREATE OR REPLACE FUNCTION public.get_admin()
RETURNS SETOF public.admins AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.admins
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add an RPC function to create the admins table (for first-time setup)
CREATE OR REPLACE FUNCTION public.create_admins_table()
RETURNS VOID AS $$
BEGIN
    -- This function is just a placeholder since we're executing the table creation
    -- directly in this migration file. In a real setup, you might want to implement
    -- additional logic here if necessary.
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Once the initial setup is complete, you can replace the initial policy with these:
-- Uncomment these policies and drop the "Initial setup policy" when ready
/*
-- Only admins can view admin records
CREATE POLICY "Admins can view admin records" ON public.admins
    FOR SELECT USING (
        is_admin()
    );

-- Admins can only update their own records
CREATE POLICY "Admins can update own record" ON public.admins
    FOR UPDATE USING (auth.uid() = id);

-- Allow inserts only for the first admin or by existing admins
CREATE POLICY "Allow admin inserts" ON public.admins
    FOR INSERT WITH CHECK (
        is_admins_empty() OR is_admin()
    );
*/ 