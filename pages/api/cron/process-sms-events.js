import { supabaseServer } from '../../../lib/supabase/server'
import { processOrderStatusChange } from '../../../lib/sms/status-listener'

/**
 * Cron job endpoint to process pending SMS notifications
 * This polls order_events for 'status_changed_sms_trigger' events that haven't been processed
 * GET /api/cron/process-sms-events
 * 
 * Can be called:
 * - Manually for testing
 * - Via a cron service (Vercel Cron, GitHub Actions, etc.)
 * - Via Supabase Edge Functions on a schedule
 */
export default async function handler(req, res) {
  // Optionally require authentication for cron jobs
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Non autorisé' })
  }

  try {
    // Récupérer les événements de changement de statut non traités
    // On cherche les événements récents (dernières 5 minutes) qui n'ont pas encore été traités
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: events, error: eventsError } = await supabaseServer
      .from('order_events')
      .select('id, order_id, payload, created_at')
      .eq('event_type', 'status_changed_sms_trigger')
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: true })
      .limit(50)

    if (eventsError) {
      console.error('[Cron SMS Events] Erreur lors de la récupération des événements:', eventsError)
      return res.status(500).json({ error: 'Impossible de récupérer les événements' })
    }

    if (!events || events.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Aucun événement à traiter',
        processed: 0,
      })
    }

    console.log(`[Cron SMS Events] Traitement de ${events.length} événement(s)`)

    const results = []
    for (const event of events) {
      const payload = event.payload || {}
      const orderId = event.order_id
      const oldStatus = payload.old_status
      const newStatus = payload.new_status

      if (!orderId || !newStatus) {
        console.warn(`[Cron SMS Events] Événement invalide: ${event.id}`)
        continue
      }

      try {
        const result = await processOrderStatusChange(orderId, oldStatus, newStatus)
        results.push({
          eventId: event.id,
          orderId,
          success: result.success,
          skipped: result.skipped,
          sid: result.sid,
          error: result.error,
        })

        // Marquer l'événement comme traité (optionnel: ajouter un champ 'processed' à order_events)
        // Pour l'instant, on ne fait rien pour éviter les doublons
      } catch (error) {
        console.error(`[Cron SMS Events] Erreur lors du traitement de l'événement ${event.id}:`, error)
        results.push({
          eventId: event.id,
          orderId,
          success: false,
          error: error.message,
        })
      }
    }

    const successCount = results.filter((r) => r.success && !r.skipped).length
    const skippedCount = results.filter((r) => r.skipped).length
    const errorCount = results.filter((r) => !r.success && !r.skipped).length

    return res.status(200).json({
      success: true,
      message: `Traitement terminé: ${successCount} SMS envoyé(s), ${skippedCount} ignoré(s), ${errorCount} erreur(s)`,
      processed: events.length,
      results: {
        success: successCount,
        skipped: skippedCount,
        errors: errorCount,
      },
      details: results,
    })
  } catch (error) {
    console.error('[Cron SMS Events] Erreur inattendue:', error)
    return res.status(500).json({
      error: 'Erreur interne du serveur',
      details: error.message,
    })
  }
}

