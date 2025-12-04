-- Migration: Trigger pour envoyer des notifications SMS lors des changements de statut
-- Ce trigger appelle une fonction HTTP pour envoyer des SMS quand le statut change
-- Note: Nécessite l'extension pg_net ou http pour appeler des APIs HTTP depuis PostgreSQL
-- Alternative: Utiliser Supabase Edge Functions ou modifier l'application pour appeler l'API

-- Fonction pour appeler l'API webhook Next.js (nécessite l'extension http ou pg_net)
-- Si l'extension n'est pas disponible, cette fonction ne fera rien
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  payload JSONB;
BEGIN
  -- Seulement si le statut a changé
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Construire l'URL du webhook (à adapter selon votre URL de production)
    -- Pour le développement local, utilisez ngrok ou une URL publique
    webhook_url := COALESCE(
      current_setting('app.webhook_url', true),
      'http://localhost:3000/api/webhooks/order-status-change'
    );
    
    -- Construire le payload
    payload := jsonb_build_object(
      'orderId', NEW.id,
      'oldStatus', OLD.status,
      'newStatus', NEW.status
    );
    
    -- Essayer d'appeler l'API HTTP (nécessite l'extension http ou pg_net)
    -- Si l'extension n'est pas disponible, cette partie sera ignorée
    BEGIN
      -- Pour Supabase, on peut utiliser pg_net
      -- PERFORM net.http_post(
      --   url := webhook_url,
      --   headers := '{"Content-Type": "application/json"}'::jsonb,
      --   body := payload::text
      -- );
      
      -- Pour l'instant, on insère juste un événement
      -- L'application Next.js peut écouter ces événements via Supabase Realtime
      INSERT INTO order_events (order_id, actor_type, event_type, payload)
      VALUES (
        NEW.id,
        'system',
        'status_changed_sms_trigger',
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'fulfillment', NEW.fulfillment,
          'webhook_url', webhook_url,
          'webhook_payload', payload
        )
      )
      ON CONFLICT DO NOTHING;
      
    EXCEPTION WHEN OTHERS THEN
      -- Si l'appel HTTP échoue, on continue quand même
      RAISE WARNING 'Impossible d''appeler le webhook: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS notify_order_status_change_trigger ON orders;
CREATE TRIGGER notify_order_status_change_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_order_status_change();

