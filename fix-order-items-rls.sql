-- Fix Row Level Security policies for the order_items table
-- Run this in the Supabase SQL Editor

-- First, check if RLS is enabled on the order_items table
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'order_items';

-- Enable Row Level Security on the order_items table if not already enabled
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might be causing issues
DROP POLICY IF EXISTS "Allow admin full access" ON public.order_items;
DROP POLICY IF EXISTS "Allow customers to view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow customers to add items to their orders" ON public.order_items;

-- Create policies to allow proper access

-- Policy to allow admins full access to order_items
CREATE POLICY "Allow admin full access" ON public.order_items
    FOR ALL
    USING (
        is_admin()
    )
    WITH CHECK (
        is_admin()
    );

-- Policy to allow customers to view their own order items
CREATE POLICY "Allow customers to view their own order items" ON public.order_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND o.customer_id = auth.uid()
        )
    );

-- Policy to allow customers to add items to their orders
CREATE POLICY "Allow customers to add items to their orders" ON public.order_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND o.customer_id = auth.uid()
        )
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