-- Migration: Add metadata column to payments table for storing transfer information
-- This allows storing transfer_id and other metadata for Stripe Connect transfers

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Optional: Add an index for faster lookups if needed
-- CREATE INDEX idx_payments_metadata_transfer_id ON public.payments USING gin ((metadata->'transfer_id'));

