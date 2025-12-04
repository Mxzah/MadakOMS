import { supabaseServer } from '../../../../lib/supabase/server'
import { sendSMS, formatPhoneForSMS } from '../../../../lib/sms/send'

/**
 * API route to check if driver is near delivery address and send SMS notification
 * POST /api/orders/[id]/check-driver-proximity
 * 
 * This should be called periodically (e.g., every 30 seconds) when order status is "enroute"
 * or triggered by driver location updates.
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

    // Récupérer la commande avec les informations nécessaires
    const { data: order, error: orderError } = await supabaseServer
      .from('orders')
      .select(`
        id,
        fulfillment,
        status,
        order_number,
        driver_id,
        delivery_address,
        delivery_name,
        customer_id,
        restaurant:restaurants ( name ),
        customer:customers ( phone )
      `)
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) {
      console.error('[Driver Proximity] Erreur lors de la récupération de la commande:', orderError)
      return res.status(500).json({ error: 'Impossible de récupérer la commande' })
    }

    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable' })
    }

    // Vérifier que c'est une commande de livraison en route
    if (order.fulfillment !== 'delivery') {
      return res.status(400).json({ error: 'Cette commande n\'est pas une livraison' })
    }

    if (order.status !== 'enroute') {
      return res.status(200).json({
        success: true,
        message: 'Commande n\'est pas en route',
        isNear: false,
      })
    }

    if (!order.driver_id) {
      return res.status(400).json({ error: 'Aucun livreur assigné à cette commande' })
    }

    if (!order.delivery_address || !order.delivery_address.lat || !order.delivery_address.lng) {
      return res.status(400).json({ error: 'Adresse de livraison invalide ou coordonnées manquantes' })
    }

    // Récupérer la position actuelle du livreur
    const { data: driverLocation, error: driverLocError } = await supabaseServer
      .from('driver_locations')
      .select('lat, lng, updated_at')
      .eq('staff_id', order.driver_id)
      .maybeSingle()

    if (driverLocError) {
      console.error('[Driver Proximity] Erreur lors de la récupération de la position du livreur:', driverLocError)
      return res.status(500).json({ error: 'Impossible de récupérer la position du livreur' })
    }

    if (!driverLocation || !driverLocation.lat || !driverLocation.lng) {
      return res.status(200).json({
        success: true,
        message: 'Position du livreur non disponible',
        isNear: false,
      })
    }

    // Calculer la distance entre le livreur et l'adresse de livraison (en mètres)
    const distance = calculateDistance(
      driverLocation.lat,
      driverLocation.lng,
      order.delivery_address.lat,
      order.delivery_address.lng
    )

    // Distance seuil pour considérer le livreur comme "proche" (500 mètres)
    const PROXIMITY_THRESHOLD = 500 // en mètres

    const isNear = distance <= PROXIMITY_THRESHOLD

    // Si le livreur est proche, envoyer un SMS (une seule fois)
    if (isNear) {
      // Vérifier si un SMS a déjà été envoyé pour cette commande
      // On peut utiliser les order_events pour tracker cela
      const { data: existingEvent } = await supabaseServer
        .from('order_events')
        .select('id')
        .eq('order_id', orderId)
        .eq('event_type', 'driver_near')
        .maybeSingle()

      if (!existingEvent) {
        // Envoyer le SMS
        const customerPhone = order.customer?.phone
        if (customerPhone) {
          const formattedPhone = formatPhoneForSMS(customerPhone)
          if (formattedPhone) {
            const restaurantName = order.restaurant?.name || 'le restaurant'
            const orderNumber = order.order_number || order.id.substring(0, 8).toUpperCase()
            const message = `Votre livreur est proche de votre adresse. Votre commande #${orderNumber} de ${restaurantName} arrivera bientôt!`

            await sendSMS(formattedPhone, message)

            // Enregistrer l'événement pour éviter d'envoyer plusieurs SMS
            await supabaseServer
              .from('order_events')
              .insert({
                order_id: orderId,
                actor_type: 'system',
                event_type: 'driver_near',
                payload: {
                  driver_id: order.driver_id,
                  distance: Math.round(distance),
                  driver_lat: driverLocation.lat,
                  driver_lng: driverLocation.lng,
                  delivery_lat: order.delivery_address.lat,
                  delivery_lng: order.delivery_address.lng,
                },
              })
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      isNear,
      distance: Math.round(distance),
      threshold: PROXIMITY_THRESHOLD,
      message: isNear ? 'Livreur proche - SMS envoyé' : 'Livreur pas encore proche',
    })
  } catch (error) {
    console.error('[Driver Proximity] Erreur inattendue:', error)
    return res.status(500).json({
      error: 'Erreur interne du serveur',
      details: error.message,
    })
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000 // Earth radius in meters
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return distance
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

