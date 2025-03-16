-- Quick Fix for RLS policies (simpler version)
-- Run this in the Supabase SQL Editor

-- ===== FIX FOR ORDERS TABLE =====
-- Check if RLS is enabled on orders table
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'orders';

-- Enable RLS on orders table if not already enabled
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for orders
DROP POLICY IF EXISTS "Allow admin full access" ON public.orders;
DROP POLICY IF EXISTS "Allow customers to view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow customers to create orders" ON public.orders;

-- Create policies for orders
-- Allow admins full access to orders
CREATE POLICY "Allow admin full access" ON public.orders
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- Allow customers to view their own orders (direct comparison)
CREATE POLICY "Allow customers to view their own orders" ON public.orders
    FOR SELECT
    USING (auth.uid() = customer_id);

-- Allow customers to create orders (direct comparison)
CREATE POLICY "Allow customers to create orders" ON public.orders
    FOR INSERT
    WITH CHECK (auth.uid() = customer_id);

-- ===== FIX FOR ORDER_ITEMS TABLE =====
-- Check if RLS is enabled on order_items table
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'order_items';

-- Enable RLS on order_items table if not already enabled
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for order_items
DROP POLICY IF EXISTS "Allow admin full access" ON public.order_items;
DROP POLICY IF EXISTS "Allow customers to view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow customers to add items to their orders" ON public.order_items;

-- Create policies for order_items
-- Allow admins full access to order_items
CREATE POLICY "Allow admin full access" ON public.order_items
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- Allow customers to view their own order items (simplified join)
CREATE POLICY "Allow customers to view their own order items" ON public.order_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND o.customer_id = auth.uid()
        )
    );

-- Allow customers to add items to their orders (simplified join)
CREATE POLICY "Allow customers to add items to their orders" ON public.order_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND o.customer_id = auth.uid()
        )
    );

-- ===== ENSURE is_admin FUNCTION EXISTS =====
-- Create the is_admin function if it doesn't exist
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admins
        WHERE id = COALESCE(user_id, auth.uid())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 