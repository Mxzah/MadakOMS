-- Migration: Replace payment_methods_accepted with payment_options_by_service
-- This allows restaurants to specify payment methods per service type (delivery/pickup)

-- Step 1: Add the new column with default value
ALTER TABLE public.restaurant_settings
ADD COLUMN payment_options_by_service jsonb NOT NULL DEFAULT '{"delivery": ["card_online", "card_terminal", "cash"], "pickup": ["card_online", "card_terminal", "cash"]}'::jsonb;

-- Step 2: Migrate existing data (if any restaurants have custom payment_methods_accepted)
-- This copies the old payment_methods_accepted to both delivery and pickup in the new structure
UPDATE public.restaurant_settings
SET payment_options_by_service = jsonb_build_object(
  'delivery', COALESCE(payment_methods_accepted, '["card_online", "card_terminal", "cash"]'::jsonb),
  'pickup', COALESCE(payment_methods_accepted, '["card_online", "card_terminal", "cash"]'::jsonb)
)
WHERE payment_methods_accepted IS NOT NULL
  AND payment_methods_accepted != '["card_online", "card_terminal", "cash"]'::jsonb;

-- Step 3: Remove the old column
ALTER TABLE public.restaurant_settings
DROP COLUMN payment_methods_accepted;

