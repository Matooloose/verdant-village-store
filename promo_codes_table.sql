-- SQL to create promo_codes table in Supabase
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_value DECIMAL(10,2),
    max_discount_cap DECIMAL(10,2),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    applicable_categories TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active);

-- Insert sample promo codes for testing
INSERT INTO promo_codes (code, description, discount_type, discount_value, min_order_value, max_discount_cap, start_date, end_date, usage_limit) VALUES
('WELCOME10', '10% off for new customers', 'percentage', 10, 100, 50, NOW(), NOW() + INTERVAL '1 year', 1000),
('SAVE20', '20% off orders over R200', 'percentage', 20, 200, 100, NOW(), NOW() + INTERVAL '6 months', 500),
('R50OFF', 'R50 off any order', 'fixed', 50, 0, NULL, NOW(), NOW() + INTERVAL '3 months', 200),
('FREESHIP', 'Free shipping on orders over R300', 'percentage', 100, 300, NULL, NOW(), NOW() + INTERVAL '1 month', NULL),
('BIGDEAL', '25% off orders over R500', 'percentage', 25, 500, 150, NOW(), NOW() + INTERVAL '2 weeks', 100);

-- RLS (Row Level Security) policies - adjust based on your needs
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active promo codes
CREATE POLICY "Anyone can read active promo codes" ON promo_codes
    FOR SELECT USING (is_active = true);

-- Only authenticated users with admin role can modify promo codes
-- You'll need to implement role-based access based on your auth setup
CREATE POLICY "Only admins can modify promo codes" ON promo_codes
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');