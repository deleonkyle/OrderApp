-- Comprehensive fix for all Row Level Security policies
-- Run this in the Supabase SQL Editor

-- First, make sure we have the is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admins
        WHERE id = COALESCE(user_id, auth.uid())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a helper function to check if a user owns a customer record
CREATE OR REPLACE FUNCTION public.is_customer_owner(customer_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.customers
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============ ITEMS TABLE ============
-- Enable RLS on items table
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for items
DROP POLICY IF EXISTS "Allow admin full access" ON public.items;
DROP POLICY IF EXISTS "Allow read access to all" ON public.items;

-- Create new policies for items
-- Allow admins full access to items
CREATE POLICY "Allow admin full access" ON public.items
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- Allow everyone to read items
CREATE POLICY "Allow read access to all" ON public.items
    FOR SELECT
    USING (true);

-- ============ ORDERS TABLE ============
-- Enable RLS on orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for orders
DROP POLICY IF EXISTS "Allow admin full access" ON public.orders;
DROP POLICY IF EXISTS "Allow customers to view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow customers to create orders" ON public.orders;

-- Create new policies for orders
-- Allow admins full access to orders
CREATE POLICY "Allow admin full access" ON public.orders
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- Allow customers to view their own orders
CREATE POLICY "Allow customers to view their own orders" ON public.orders
    FOR SELECT
    USING (
        auth.uid() = customer_id
    );

-- Allow customers to create orders
CREATE POLICY "Allow customers to create orders" ON public.orders
    FOR INSERT
    WITH CHECK (
        auth.uid() = customer_id
    );

-- ============ ORDER_ITEMS TABLE ============
-- Enable RLS on order_items table
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for order_items
DROP POLICY IF EXISTS "Allow admin full access" ON public.order_items;
DROP POLICY IF EXISTS "Allow customers to view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow customers to add items to their orders" ON public.order_items;

-- Create new policies for order_items
-- Allow admins full access to order_items
CREATE POLICY "Allow admin full access" ON public.order_items
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- Allow customers to view their own order items
CREATE POLICY "Allow customers to view their own order items" ON public.order_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND o.customer_id = auth.uid()
        )
    );

-- Allow customers to add items to their orders
CREATE POLICY "Allow customers to add items to their orders" ON public.order_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND o.customer_id = auth.uid()
        )
    );

-- ============ EMERGENCY FALLBACK ============
-- If you still face issues, uncomment and run the following commands to temporarily disable RLS:
/*
-- CAUTION: This removes all security - use only for testing
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.items DISABLE ROW LEVEL SECURITY;
*/ 