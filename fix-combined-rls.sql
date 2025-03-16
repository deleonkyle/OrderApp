-- Combined fix for orders and order_items tables to resolve RLS permission issues
-- Run this script in the Supabase SQL Editor

----------------------------------------
-- First, check if RLS is enabled on tables
----------------------------------------
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('orders', 'order_items', 'items');

----------------------------------------
-- OPTION 1: EMERGENCY FIX - DISABLE RLS TEMPORARILY
-- Only use this if you need immediate access and will properly configure later
----------------------------------------
-- ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.items DISABLE ROW LEVEL SECURITY;

----------------------------------------
-- OPTION 2: PROPER RLS CONFIGURATION (RECOMMENDED)
----------------------------------------

-- Create or update the is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admins
        WHERE id = COALESCE(user_id, auth.uid())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the is_owner function for customers
CREATE OR REPLACE FUNCTION public.is_owner_of_order(order_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.orders
        WHERE id = order_id
        AND customer_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

----------------
-- ITEMS TABLE
----------------
-- Enable RLS on items table
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow admin full access" ON public.items;
DROP POLICY IF EXISTS "Allow all users to read items" ON public.items;

-- Create policies
-- Everyone can read items
CREATE POLICY "Allow all users to read items" ON public.items
    FOR SELECT USING (true);

-- Only admins can modify items
CREATE POLICY "Allow admin full access" ON public.items
    FOR ALL 
    USING (is_admin())
    WITH CHECK (is_admin());

----------------
-- ORDERS TABLE
----------------
-- Enable RLS on orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow admin full access" ON public.orders;
DROP POLICY IF EXISTS "Allow customers to view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow customers to create orders" ON public.orders;
DROP POLICY IF EXISTS "Allow customers to update their own orders" ON public.orders;

-- Create policies for orders table
-- Admins have full access to all orders
CREATE POLICY "Allow admin full access" ON public.orders
    FOR ALL 
    USING (is_admin())
    WITH CHECK (is_admin());

-- Customers can view only their own orders
CREATE POLICY "Allow customers to view their own orders" ON public.orders
    FOR SELECT
    USING (auth.uid() = customer_id);

-- Customers can create orders for themselves
CREATE POLICY "Allow customers to create orders" ON public.orders
    FOR INSERT
    WITH CHECK (auth.uid() = customer_id);

-- Customers can update their own orders (e.g., for cancellation)
CREATE POLICY "Allow customers to update their own orders" ON public.orders
    FOR UPDATE
    USING (auth.uid() = customer_id)
    WITH CHECK (auth.uid() = customer_id);

----------------
-- ORDER_ITEMS TABLE
----------------
-- Enable RLS on order_items table
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow admin full access" ON public.order_items;
DROP POLICY IF EXISTS "Allow customers to view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow customers to add items to their orders" ON public.order_items;
DROP POLICY IF EXISTS "Allow customers to update items in their orders" ON public.order_items;

-- Create policies for order_items table
-- Admins have full access to all order items
CREATE POLICY "Allow admin full access" ON public.order_items
    FOR ALL 
    USING (is_admin())
    WITH CHECK (is_admin());

-- Customers can view items in their own orders
CREATE POLICY "Allow customers to view their own order items" ON public.order_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND o.customer_id = auth.uid()
        )
    );

-- Customers can add items to their own orders
CREATE POLICY "Allow customers to add items to their orders" ON public.order_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND o.customer_id = auth.uid()
        )
    );

-- Customers can update items in their own orders (e.g., change quantity)
CREATE POLICY "Allow customers to update items in their orders" ON public.order_items
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND o.customer_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND o.customer_id = auth.uid()
        )
    );

----------------------------------------
-- VERIFY CONFIGURATIONS
----------------------------------------
-- Check that RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('orders', 'order_items', 'items');

-- List all policies for our tables
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('orders', 'order_items', 'items')
ORDER BY tablename, policyname; 