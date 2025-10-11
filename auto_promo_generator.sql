-- Auto-generating promo code system
-- Run this in Supabase SQL editor

-- Function to generate random promo codes
CREATE OR REPLACE FUNCTION generate_promo_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    -- Generate 8 character random code
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    
    -- Add prefix for identification
    RETURN 'AUTO' || result;
END;
$$ LANGUAGE plpgsql;

-- Function to create daily changing promo codes
CREATE OR REPLACE FUNCTION create_daily_promo()
RETURNS VOID AS $$
DECLARE
    today_code TEXT;
    tomorrow_code TEXT;
BEGIN
    -- Generate today's code
    today_code := 'DAILY' || TO_CHAR(CURRENT_DATE, 'MMDD');
    
    -- Generate tomorrow's code
    tomorrow_code := 'DAILY' || TO_CHAR(CURRENT_DATE + INTERVAL '1 day', 'MMDD');
    
    -- Insert/Update today's code
    INSERT INTO promo_codes (code, description, discount_type, discount_value, min_order_value, start_date, end_date, usage_limit)
    VALUES (today_code, 'Daily special - 15% off orders over R150', 'percentage', 15, 150, CURRENT_DATE, CURRENT_DATE + INTERVAL '23 hours 59 minutes', 100)
    ON CONFLICT (code) DO UPDATE SET
        is_active = true,
        start_date = CURRENT_DATE,
        end_date = CURRENT_DATE + INTERVAL '23 hours 59 minutes';
    
    -- Prepare tomorrow's code
    INSERT INTO promo_codes (code, description, discount_type, discount_value, min_order_value, start_date, end_date, usage_limit)
    VALUES (tomorrow_code, 'Daily special - 15% off orders over R150', 'percentage', 15, 150, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '2 days', 100)
    ON CONFLICT (code) DO NOTHING;
    
    -- Deactivate expired codes
    UPDATE promo_codes 
    SET is_active = false 
    WHERE end_date < CURRENT_TIMESTAMP AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Create a weekly rotating promo system
CREATE OR REPLACE FUNCTION create_weekly_promo()
RETURNS VOID AS $$
DECLARE
    week_num INTEGER;
    week_code TEXT;
    discount_val INTEGER;
BEGIN
    -- Get current week number
    week_num := EXTRACT(week FROM CURRENT_DATE);
    
    -- Create code based on week
    week_code := 'WEEK' || LPAD(week_num::TEXT, 2, '0');
    
    -- Varying discount based on week (15-25%)
    discount_val := 15 + (week_num % 3) * 5;
    
    -- Insert weekly code
    INSERT INTO promo_codes (code, description, discount_type, discount_value, min_order_value, start_date, end_date, usage_limit)
    VALUES (week_code, 'Weekly special - ' || discount_val || '% off orders over R200', 'percentage', discount_val, 200, DATE_TRUNC('week', CURRENT_DATE), DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week', 200)
    ON CONFLICT (code) DO UPDATE SET
        is_active = true,
        discount_value = discount_val,
        description = 'Weekly special - ' || discount_val || '% off orders over R200';
END;
$$ LANGUAGE plpgsql;

-- Flash sale codes (limited time)
CREATE OR REPLACE FUNCTION create_flash_sale(duration_hours INTEGER DEFAULT 2)
RETURNS TEXT AS $$
DECLARE
    flash_code TEXT;
    flash_discount INTEGER;
BEGIN
    -- Generate unique flash code
    flash_code := 'FLASH' || TO_CHAR(CURRENT_TIMESTAMP, 'DDHH24MI');
    
    -- Random discount between 20-40%
    flash_discount := 20 + floor(random() * 21)::INTEGER;
    
    -- Create flash sale code
    INSERT INTO promo_codes (code, description, discount_type, discount_value, min_order_value, max_discount_cap, start_date, end_date, usage_limit)
    VALUES (flash_code, 'FLASH SALE! ' || flash_discount || '% off - Limited time!', 'percentage', flash_discount, 100, 200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 hour' * duration_hours, 50);
    
    RETURN flash_code;
END;
$$ LANGUAGE plpgsql;

-- Seasonal/holiday codes
CREATE OR REPLACE FUNCTION create_seasonal_promo()
RETURNS VOID AS $$
DECLARE
    season_code TEXT;
    season_name TEXT;
    discount_val INTEGER;
BEGIN
    -- Determine season based on month
    CASE EXTRACT(month FROM CURRENT_DATE)
        WHEN 12, 1, 2 THEN 
            season_code := 'SUMMER' || EXTRACT(year FROM CURRENT_DATE)::TEXT;
            season_name := 'Summer';
            discount_val := 25;
        WHEN 3, 4, 5 THEN 
            season_code := 'AUTUMN' || EXTRACT(year FROM CURRENT_DATE)::TEXT;
            season_name := 'Autumn';
            discount_val := 20;
        WHEN 6, 7, 8 THEN 
            season_code := 'WINTER' || EXTRACT(year FROM CURRENT_DATE)::TEXT;
            season_name := 'Winter';
            discount_val := 30;
        WHEN 9, 10, 11 THEN 
            season_code := 'SPRING' || EXTRACT(year FROM CURRENT_DATE)::TEXT;
            season_name := 'Spring';
            discount_val := 22;
    END CASE;
    
    -- Create seasonal code (3 month validity)
    INSERT INTO promo_codes (code, description, discount_type, discount_value, min_order_value, start_date, end_date, usage_limit)
    VALUES (season_code, season_name || ' Special - ' || discount_val || '% off fresh produce', 'percentage', discount_val, 300, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months', 1000)
    ON CONFLICT (code) DO UPDATE SET
        is_active = true,
        description = season_name || ' Special - ' || discount_val || '% off fresh produce';
END;
$$ LANGUAGE plpgsql;

-- Schedule automatic promo generation (run daily)
-- You can set this up as a cron job or Supabase Edge Function
SELECT cron.schedule('daily-promo-generation', '0 0 * * *', 'SELECT create_daily_promo();');
SELECT cron.schedule('weekly-promo-generation', '0 0 * * 1', 'SELECT create_weekly_promo();');
SELECT cron.schedule('seasonal-promo-generation', '0 0 1 * *', 'SELECT create_seasonal_promo();');

-- Manual execution examples:
-- Generate today's promo: SELECT create_daily_promo();
-- Generate this week's promo: SELECT create_weekly_promo();
-- Create flash sale (2 hours): SELECT create_flash_sale(2);
-- Generate seasonal promo: SELECT create_seasonal_promo();