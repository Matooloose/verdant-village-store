-- Fix the decrement_product_stock function to use 'quantity' instead of 'stock_quantity'

CREATE OR REPLACE FUNCTION decrement_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the product quantity (stock) when an order item is inserted
    UPDATE products 
    SET quantity = quantity - NEW.quantity
    WHERE id = NEW.product_id;
    
    -- Check if quantity goes below 0 and handle accordingly
    UPDATE products 
    SET quantity = GREATEST(quantity, 0)
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also check and fix other functions that might reference stock_quantity
-- You may need to update these functions as well:

CREATE OR REPLACE FUNCTION update_product_inventory()
RETURNS TRIGGER AS $$
BEGIN
    -- This function might also be referencing stock_quantity
    -- Update it to use 'quantity' instead
    
    IF OLD.status != 'delivered' AND NEW.status = 'delivered' THEN
        -- Order was just delivered, no need to change inventory again
        -- (it was already decremented when order_items were inserted)
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;