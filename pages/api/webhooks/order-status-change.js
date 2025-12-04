import { supabaseServer } from '../../../lib/supabase/server'
import { sendSMS, formatPhoneForSMS } from '../../../lib/sms/send'

/**
 * Webhook endpoint to handle order status changes
 * This can be called by Supabase triggers or external systems
 * POST /api/webhooks/order-status-change
 * Body: { orderId, oldStatus, newStatus }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    const { orderId, oldStatus, newStatus } = req.body

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'ID de commande requis' })
    }

    if (!newStatus || typeof newStatus !== 'string') {
      return res.status(400).json({ error: 'Nouveau statut requis' })
    }

    // Note: Les remboursements sont gérés automatiquement par le cron job
    // (process-refund-events.js) qui traite les événements créés par le trigger SQL

    // Récupérer les informations complètes de la commande
    const { data: order, error: orderError } = await supabaseServer
      .from('orders')
      .select(`
        id,
        fulfillment,
        status,
        order_number,
        pickup_phone,
        delivery_name,
        customer_id,
        restaurant_id,
        restaurant:restaurants ( name ),
        customer:customers ( phone )
      `)
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) {
      return res.status(500).json({ error: 'Impossible de récupérer la commande' })
    }

    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' })
    }

    // Déterminer le numéro de téléphone du client
    let customerPhone = null
    if (order.fulfillment === 'pickup') {
      customerPhone = order.pickup_phone
    } else if (order.fulfillment === 'delivery') {
      customerPhone = order.customer?.phone
    }

    if (!customerPhone) {
      return res.status(200).json({
        success: true,
        message: 'Pas de numéro de téléphone disponible',
        skipped: true,
      })
    }

    const formattedPhone = formatPhoneForSMS(customerPhone)
    if (!formattedPhone) {
      return res.status(200).json({
        success: true,
        message: 'Format de numéro invalide',
        skipped: true,
      })
    }

    const restaurantName = order.restaurant?.name || 'le restaurant'
    const orderNumber = order.order_number || order.id.substring(0, 8).toUpperCase()

    let message = ''

    // Messages pour la livraison
    if (order.fulfillment === 'delivery') {
      if (newStatus === 'preparing') {
        message = `Bonjour ${order.delivery_name || ''}, votre commande #${orderNumber} a été approuvée et est en préparation. ${restaurantName} vous contactera bientôt.`
      } else if (newStatus === 'enroute') {
        message = `Votre commande #${orderNumber} est prête. Le livreur va la chercher au restaurant et sera bientôt en route vers vous.`
      }
    }
    // Messages pour la cueillette
    else if (order.fulfillment === 'pickup') {
      if (newStatus === 'preparing') {
        message = `Bonjour, votre commande #${orderNumber} a été approuvée et est en préparation chez ${restaurantName}.`
      } else if (newStatus === 'ready') {
        message = `Votre commande #${orderNumber} est prête à être récupérée chez ${restaurantName}. Vous pouvez venir la chercher.`
      }
    }

    if (!message) {
      return res.status(200).json({
        success: true,
        message: 'Aucun SMS configuré pour ce statut',
        status: newStatus,
        fulfillment: order.fulfillment,
      })
    }

    const result = await sendSMS(formattedPhone, message.trim())

    if (!result.success) {
      return res.status(500).json({
        error: 'Impossible d\'envoyer le SMS',
        details: result.error,
      })
    }
    return res.status(200).json({
      success: true,
      message: 'SMS envoyé avec succès',
      sid: result.sid,
      sentTo: formattedPhone,
      orderNumber,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Erreur interne du serveur',
      details: error.message,
    })
  }
}

