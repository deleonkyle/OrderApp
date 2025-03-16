-- Fix Row Level Security policies for the orders table
-- Run this in the Supabase SQL Editor

-- First, check if RLS is enabled on the orders table
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'orders';

-- Enable Row Level Security on the orders table if not already enabled
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might be causing issues
DROP POLICY IF EXISTS "Allow admin full access" ON public.orders;
DROP POLICY IF EXISTS "Allow customers to view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow customers to create orders" ON public.orders;

-- Create policies to allow proper access

-- Policy to allow admins full access to orders
CREATE POLICY "Allow admin full access" ON public.orders
    FOR ALL
    USING (
        is_admin()
    )
    WITH CHECK (
        is_admin()
    );

-- Policy to allow customers to view their own orders
CREATE POLICY "Allow customers to view their own orders" ON public.orders
    FOR SELECT
    USING (
        auth.uid() = customer_id
    );

-- Policy to allow customers to create orders
CREATE POLICY "Allow customers to create orders" ON public.orders
    FOR INSERT
    WITH CHECK (
        auth.uid() = customer_id
    );

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