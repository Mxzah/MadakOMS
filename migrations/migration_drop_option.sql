-- Migration: Add drop_option column to orders table
-- This stores the delivery drop option: 'hand' (En main propre) or 'door' (Laisser à la porte)
-- Only applicable for delivery orders

-- Step 1: Add the new column (nullable, as it only applies to delivery orders)
ALTER TABLE public.orders
ADD COLUMN drop_option text;

-- Step 2: Add a check constraint to ensure only valid values
ALTER TABLE public.orders
ADD CONSTRAINT orders_drop_option_check 
CHECK (drop_option IS NULL OR drop_option IN ('hand', 'door'));

-- Step 3: Migrate existing data from delivery_address JSONB field (if any)
-- This extracts the dropOption from the JSONB delivery_address field
UPDATE public.orders
SET drop_option = (delivery_address->>'dropOption')::text
WHERE fulfillment = 'delivery' 
  AND delivery_address IS NOT NULL 
  AND delivery_address->>'dropOption' IS NOT NULL
  AND drop_option IS NULL;

-- Step 4: Add a comment for documentation
COMMENT ON COLUMN public.orders.drop_option IS 
'Delivery drop option: "hand" for "En main propre" (hand-to-hand), "door" for "Laisser à la porte" (leave at door). Only applicable for delivery orders.';

