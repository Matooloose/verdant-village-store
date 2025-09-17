-- Fix farms RLS policy to allow public access for viewing farms
DROP POLICY IF EXISTS "Authenticated users can view farms" ON public.farms;

CREATE POLICY "Public can view farms" 
ON public.farms 
FOR SELECT 
USING (true);

-- Create some sample farms data with proper UUIDs
INSERT INTO public.farms (name, location, description, farmer_id, image_url) 
VALUES 
  ('Green Valley Farm', 'Western Cape, South Africa', 'Organic vegetables and fruits grown sustainably', gen_random_uuid(), 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400'),
  ('Sunny Acres', 'KwaZulu-Natal, South Africa', 'Fresh dairy products and free-range eggs', gen_random_uuid(), 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400'),
  ('Organic Fields', 'Gauteng, South Africa', 'Premium organic produce delivered fresh daily', gen_random_uuid(), 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=400')
ON CONFLICT (id) DO NOTHING;

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