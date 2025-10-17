-- Fix stock_quantity trigger issue
-- This migration addresses the issue where triggers reference non-existent stock_quantity column

-- First, let's check if there are any triggers referencing stock_quantity and fix them

-- Drop and recreate any problematic triggers that reference stock_quantity
-- This is a safe approach since we'll recreate them correctly

-- Create or replace a function that properly handles inventory updates for order items
CREATE OR REPLACE FUNCTION update_product_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- When order items are inserted (new order), reduce product quantity
  IF TG_OP = 'INSERT' THEN
    UPDATE public.products 
    SET quantity = GREATEST(0, quantity - NEW.quantity)
    WHERE id = NEW.product_id;
  END IF;
  
  -- When order items are updated, adjust quantity difference
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.products 
    SET quantity = GREATEST(0, quantity + OLD.quantity - NEW.quantity)
    WHERE id = NEW.product_id;
  END IF;
  
  -- When order items are deleted (order cancelled), restore quantity
  IF TG_OP = 'DELETE' THEN
    UPDATE public.products 
    SET quantity = quantity + OLD.quantity
    WHERE id = OLD.product_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (it might be the problematic one)
DROP TRIGGER IF EXISTS update_product_stock_on_order_item ON public.order_items;
DROP TRIGGER IF EXISTS update_stock_quantity ON public.order_items;
DROP TRIGGER IF EXISTS order_items_stock_update ON public.order_items;

-- Create the correct trigger
CREATE TRIGGER update_product_inventory_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION update_product_inventory();

-- Ensure products table has the correct quantity column
-- Add quantity column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'quantity') THEN
        ALTER TABLE public.products ADD COLUMN quantity integer DEFAULT 100;
    END IF;
END $$;

-- Update any existing products to have default quantity if null
UPDATE public.products SET quantity = 100 WHERE quantity IS NULL;