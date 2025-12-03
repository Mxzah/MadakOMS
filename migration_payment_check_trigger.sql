-- Migration: Trigger pour annuler automatiquement la commande si le paiement n'est pas confirmé
-- Ce trigger vérifie que si on passe à "preparing", le paiement Stripe doit être confirmé
-- Si le paiement n'est pas confirmé, la commande est automatiquement annulée
-- NOTE: Le remboursement sera géré par l'API /api/stripe/cancel-payment appelée depuis le frontend

-- Fonction pour vérifier le paiement avant de passer à "preparing"
CREATE OR REPLACE FUNCTION check_payment_before_preparing()
RETURNS TRIGGER AS $$
DECLARE
  payment_record RECORD;
BEGIN
  -- Seulement vérifier si on passe de "received" à "preparing"
  IF OLD.status = 'received' AND NEW.status = 'preparing' THEN
    -- Vérifier s'il y a un paiement Stripe pour cette commande
    SELECT id, processor, status, processor_id, auth_code
    INTO payment_record
    FROM payments
    WHERE order_id = NEW.id
      AND processor = 'stripe'
    LIMIT 1;
    
    -- Si un paiement Stripe existe
    IF payment_record.id IS NOT NULL THEN
      -- Le paiement doit être "paid" pour passer à "preparing"
      IF payment_record.status != 'paid' THEN
        -- Au lieu de lancer une exception, annuler automatiquement la commande
        NEW.status := 'cancelled';
        NEW.cancelled_at := NOW();
        NEW.failure_reason := 'Paiement non confirmé - commande annulée automatiquement';
        
        -- Mettre à jour le statut du paiement à "failed"
        UPDATE payments
        SET status = 'failed'
        WHERE id = payment_record.id;
        
        -- NOTE: Le remboursement sera géré par l'API /api/stripe/cancel-payment
        -- qui sera appelée automatiquement depuis le frontend quand le statut passe à "cancelled"
        
        -- Retourner la commande avec le statut "cancelled"
        RETURN NEW;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS check_payment_before_preparing_trigger ON orders;
CREATE TRIGGER check_payment_before_preparing_trigger
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION check_payment_before_preparing();

