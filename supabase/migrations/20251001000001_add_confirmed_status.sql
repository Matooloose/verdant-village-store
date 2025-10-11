-- Fix order_status enum and constraints to include 'confirmed' and 'completed' statuses
-- This handles both enum types and check constraints

-- First, check if order_status is an enum type and add missing values
DO $$ 
BEGIN
    -- Check if order_status enum exists and add missing values
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        -- Add 'completed' if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'completed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')) THEN
            ALTER TYPE order_status ADD VALUE 'completed';
        END IF;
        
        -- Add 'confirmed' if it doesn't exist  
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'confirmed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')) THEN
            ALTER TYPE order_status ADD VALUE 'confirmed';
        END IF;
    ELSE
        -- Create the enum type if it doesn't exist
        CREATE TYPE order_status AS ENUM ('pending', 'processing', 'completed', 'confirmed', 'failed', 'cancelled');
    END IF;
END $$;

-- Ensure orders table uses the enum type
DO $$
BEGIN
    -- Check if status column exists and update its type if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status') THEN
        -- Change column to use enum type if it's not already
        BEGIN
            ALTER TABLE public.orders ALTER COLUMN status TYPE order_status USING status::order_status;
        EXCEPTION
            WHEN others THEN
                -- If conversion fails, column might already be correct type
                NULL;
        END;
    END IF;
END $$;

-- Remove any conflicting check constraints
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

-- Add helpful comment
COMMENT ON TYPE order_status IS 'Valid order statuses: pending (initial), processing (payment started), completed (order fulfilled), confirmed (payment verified), failed (payment failed), cancelled (order cancelled)';

-- Ensure default value is valid
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending';