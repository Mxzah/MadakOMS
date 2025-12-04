-- Migration: Ajouter le support Stripe Connect pour permettre à chaque restaurant d'avoir son propre compte Stripe
-- Chaque restaurant peut maintenant avoir son propre stripe_account_id (compte Stripe Connect)

-- Ajouter la colonne stripe_account_id dans restaurant_settings
-- Cette colonne stocke l'ID du compte Stripe Connect associé au restaurant
ALTER TABLE public.restaurant_settings
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

-- Ajouter un commentaire pour documenter cette colonne
COMMENT ON COLUMN public.restaurant_settings.stripe_account_id IS 
'ID du compte Stripe Connect associé au restaurant (ex: acct_xxxxx). 
Si NULL, le système utilisera le compte Stripe principal de la plateforme.';

-- Exemple d'utilisation:
-- UPDATE public.restaurant_settings
-- SET stripe_account_id = 'acct_1234567890abcdef'
-- WHERE restaurant_id = 'uuid-du-restaurant';

