import { processOrderStatusChange } from '../../../lib/sms/status-listener'

/**
 * Webhook endpoint to process order events from Supabase
 * This listens for order_events with type 'status_changed_sms_trigger'
 * POST /api/webhooks/supabase-order-events
 * 
 * This can be called:
 * 1. Manually after status changes
 * 2. Via a cron job that polls for new events
 * 3. Via Supabase Edge Functions
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    const { orderId, oldStatus, newStatus, eventId } = req.body

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'ID de commande requis' })
    }

    if (!newStatus || typeof newStatus !== 'string') {
      return res.status(400).json({ error: 'Nouveau statut requis' })
    }

    console.log(`[Webhook Order Events] Traitement du changement de statut: ${orderId} ${oldStatus || 'N/A'} -> ${newStatus}`)

    const result = await processOrderStatusChange(orderId, oldStatus, newStatus)

    if (!result.success) {
      return res.status(500).json({
        error: 'Impossible de traiter le changement de statut',
        details: result.error,
      })
    }

    if (result.skipped) {
      return res.status(200).json({
        success: true,
        message: 'SMS non envoyé',
        reason: result.reason,
      })
    }

    return res.status(200).json({
      success: true,
      message: 'SMS envoyé avec succès',
      sid: result.sid,
    })
  } catch (error) {
    console.error('[Webhook Order Events] Erreur inattendue:', error)
    return res.status(500).json({
      error: 'Erreur interne du serveur',
      details: error.message,
    })
  }
}

