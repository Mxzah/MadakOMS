-- Migration: Add apartment_suite column to orders table
-- This stores the apartment/suite number for delivery addresses
-- Only applicable for delivery orders

-- Step 1: Add the new column (nullable, as it only applies when provided)
-- Using varchar(100) instead of text for better validation and documentation
ALTER TABLE public.orders
ADD COLUMN apartment_suite varchar(100);

-- Step 2: Migrate existing data from delivery_address JSONB field (if any)
-- This extracts the apartmentSuite from the JSONB delivery_address field
UPDATE public.orders
SET apartment_suite = (delivery_address->>'apartmentSuite')::text
WHERE fulfillment = 'delivery' 
  AND delivery_address IS NOT NULL 
  AND delivery_address->>'apartmentSuite' IS NOT NULL
  AND delivery_address->>'apartmentSuite' != ''
  AND apartment_suite IS NULL;

-- Step 3: Add a comment for documentation
COMMENT ON COLUMN public.orders.apartment_suite IS 
'Apartment or suite number for delivery address. Only applicable for delivery orders.';

