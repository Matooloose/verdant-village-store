-- Fix farms RLS policy to allow public access for viewing farms
DROP POLICY IF EXISTS "Authenticated users can view farms" ON public.farms;

CREATE POLICY "Public can view farms" 
ON public.farms 
FOR SELECT 
USING (true);

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