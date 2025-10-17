-- Temporarily disable the problematic trigger
-- Run this in your Supabase SQL editor:

DROP TRIGGER IF EXISTS trigger_decrement_product_stock ON order_items;

-- You can also drop the function if needed:
-- DROP FUNCTION IF EXISTS decrement_product_stock();

-- After fixing the function to use 'quantity' instead of 'stock_quantity', 
-- you can recreate the trigger:
-- CREATE TRIGGER trigger_decrement_product_stock
-- AFTER INSERT ON order_items FOR EACH ROW
-- EXECUTE FUNCTION decrement_product_stock();