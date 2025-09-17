-- Fix farms RLS policy to allow public access for viewing farms
DROP POLICY IF EXISTS "Authenticated users can view farms" ON public.farms;

CREATE POLICY "Public can view farms" 
ON public.farms 
FOR SELECT 
USING (true);

-- Create some sample farms data
INSERT INTO public.farms (name, location, description, farmer_id, image_url) 
VALUES 
  ('Green Valley Farm', 'Western Cape, South Africa', 'Organic vegetables and fruits grown sustainably', 'b8f7e4c5-3a2b-4c1d-8e9f-1a2b3c4d5e6f', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400'),
  ('Sunny Acres', 'KwaZulu-Natal, South Africa', 'Fresh dairy products and free-range eggs', 'c9g8f5d6-4b3c-5d2e-9f0g-2b3c4d5e6f7g', 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400'),
  ('Organic Fields', 'Gauteng, South Africa', 'Premium organic produce delivered fresh daily', 'd0h9g6e7-5c4d-6e3f-0g1h-3c4d5e6f7g8h', 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=400')
ON CONFLICT (id) DO NOTHING;

-- Update orders table to include farmer visibility
-- Add policy for farmers to see orders for their products
CREATE POLICY "Farmers can view orders for their products" 
ON public.orders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.products p ON oi.product_id = p.id
    WHERE oi.order_id = orders.id AND p.farmer_id = auth.uid()
  )
);

-- Add payment method options to orders when payment is made
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_method_selected text;

-- Add more detailed payment status tracking
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
    CREATE TYPE payment_method_type AS ENUM ('cash_on_delivery', 'card', 'bank_transfer', 'mobile_payment');
  END IF;
END $$;

ALTER TABLE public.orders 
ALTER COLUMN payment_method TYPE payment_method_type USING payment_method::payment_method_type;