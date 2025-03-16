-- EMERGENCY FIX: This will temporarily disable RLS on order-related tables
-- This should be used only as a temporary solution until proper RLS policies can be implemented
-- Run this in the Supabase SQL Editor

-- Disable RLS on orders table
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;

-- Disable RLS on order_items table
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;

-- WARNING: This will allow any authenticated user to access all orders and order items
-- This should be reverted after testing and replaced with proper policies

-- REVERT COMMANDS (Run these after testing is complete to re-enable RLS):
/*
-- Re-enable RLS on orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Re-enable RLS on order_items table
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Then apply proper security policies by running the fix-orders-rls.sql and fix-order-items-rls.sql scripts
*/ 