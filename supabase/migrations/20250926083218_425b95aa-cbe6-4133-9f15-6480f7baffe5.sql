-- Fix missing payment_method_selected column and add PayFast integration support
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_method_selected text;

-- Add PayFast specific columns for payment tracking
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_id text,
ADD COLUMN IF NOT EXISTS payment_reference text;