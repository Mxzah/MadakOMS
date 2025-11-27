-- Migration: Add delivery_alternatives field to restaurant_settings
-- This allows restaurants to provide links to third-party delivery services (DoorDash, UberEats, etc.)
-- when an address is outside their delivery zone

-- Add the new column (nullable, so restaurants without alternatives won't have this field)
ALTER TABLE public.restaurant_settings
ADD COLUMN delivery_alternatives jsonb;

-- Example of how to populate this field for a restaurant:
-- UPDATE public.restaurant_settings
-- SET delivery_alternatives = '{"doordash": "https://www.doordash.com/store/restaurant-name/123456"}'::jsonb
-- WHERE restaurant_id = 'your-restaurant-uuid-here';

-- Example with multiple alternatives:
-- UPDATE public.restaurant_settings
-- SET delivery_alternatives = '{
--   "doordash": "https://www.doordash.com/store/restaurant-name/123456",
--   "ubereats": "https://www.ubereats.com/ca/store/restaurant-name/abc123",
--   "skip": "https://www.skipthedishes.com/restaurant-name"
-- }'::jsonb
-- WHERE restaurant_id = 'your-restaurant-uuid-here';

