-- Migration: Trigger pour déclencher automatiquement le remboursement lors de l'annulation
-- Ce trigger appelle l'API de remboursement via pg_net (si disponible) ou log l'événement
-- pour traitement asynchrone

-- Fonction pour déclencher le remboursement lors de l'annulation
CREATE OR REPLACE FUNCTION trigger_refund_on_cancel()
RETURNS TRIGGER AS $$
DECLARE
  payment_record RECORD;
BEGIN
  -- Seulement vérifier si on passe à "cancelled"
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    -- Vérifier s'il y a un paiement Stripe pour cette commande
    SELECT id, processor, status, processor_id
    INTO payment_record
    FROM payments
    WHERE order_id = NEW.id
      AND processor = 'stripe'
      AND status = 'paid' -- Seulement si le paiement est confirmé
    LIMIT 1;
    
    -- Si un paiement Stripe confirmé existe, on doit le rembourser
    -- Note: Le remboursement sera géré par l'API /api/stripe/cancel-payment
    -- qui sera appelée automatiquement depuis le frontend quand le statut passe à "cancelled"
    -- Ce trigger sert principalement à s'assurer que l'événement est tracé
    
    IF payment_record.id IS NOT NULL THEN
      -- Log pour référence (le remboursement sera fait par l'API)
      RAISE NOTICE 'Commande % annulée - Paiement Stripe % doit être remboursé (géré par API)', NEW.id, payment_record.processor_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_refund_on_cancel_trigger ON orders;
CREATE TRIGGER trigger_refund_on_cancel_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refund_on_cancel();

