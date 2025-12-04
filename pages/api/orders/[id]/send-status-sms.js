import { supabaseServer } from '../../../../lib/supabase/server'
import { sendSMS, formatPhoneForSMS } from '../../../../lib/sms/send'

/**
 * API route to manually trigger SMS notification for an order status
 * POST /api/orders/[id]/send-status-sms
 * 
 * This can be called after a status change to ensure SMS is sent,
 * even if the status was changed directly in the database.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    const { id: orderId } = req.query

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'ID de commande requis' })
    }

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
      console.error('[Send Status SMS] Erreur lors de la récupération de la commande:', orderError)
      return res.status(500).json({ error: 'Impossible de récupérer la commande' })
    }

    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' })
    }

    console.log(`[Send Status SMS] Commande ${orderId}, statut: ${order.status}, fulfillment: ${order.fulfillment}`)

    // Déterminer le numéro de téléphone du client
    let customerPhone = null
    if (order.fulfillment === 'pickup') {
      customerPhone = order.pickup_phone
    } else if (order.fulfillment === 'delivery') {
      customerPhone = order.customer?.phone
    }

    if (!customerPhone) {
      return res.status(400).json({
        error: 'Numéro de téléphone non disponible',
        message: `Aucun numéro de téléphone trouvé pour cette commande (fulfillment: ${order.fulfillment})`,
      })
    }

    const formattedPhone = formatPhoneForSMS(customerPhone)
    if (!formattedPhone) {
      return res.status(400).json({
        error: 'Format de numéro de téléphone invalide',
        provided: customerPhone,
      })
    }

    const restaurantName = order.restaurant?.name || 'le restaurant'
    const orderNumber = order.order_number || order.id.substring(0, 8).toUpperCase()

    let message = ''

    // Messages pour la livraison
    if (order.fulfillment === 'delivery') {
      if (order.status === 'preparing') {
        message = `Bonjour ${order.delivery_name || ''}, votre commande #${orderNumber} a été approuvée et est en préparation. ${restaurantName} vous contactera bientôt.`
      } else if (order.status === 'enroute') {
        message = `Votre commande #${orderNumber} est prête. Le livreur va la chercher au restaurant et sera bientôt en route vers vous.`
      }
    }
    // Messages pour la cueillette
    else if (order.fulfillment === 'pickup') {
      if (order.status === 'preparing') {
        message = `Bonjour, votre commande #${orderNumber} a été approuvée et est en préparation chez ${restaurantName}.`
      } else if (order.status === 'ready') {
        message = `Votre commande #${orderNumber} est prête à être récupérée chez ${restaurantName}. Vous pouvez venir la chercher.`
      }
    }

    if (!message) {
      return res.status(200).json({
        success: true,
        message: 'Aucun SMS configuré pour ce statut',
        status: order.status,
        fulfillment: order.fulfillment,
      })
    }

    console.log(`[Send Status SMS] Envoi du SMS à ${formattedPhone} pour la commande #${orderNumber}`)
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
    console.error('[Send Status SMS] Erreur inattendue:', error)
    return res.status(500).json({
      error: 'Erreur interne du serveur',
      details: error.message,
    })
  }
}

