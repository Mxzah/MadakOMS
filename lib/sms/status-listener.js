import { supabaseServer } from '../supabase/server'
import { sendSMS, formatPhoneForSMS } from './send'

/**
 * Listen for order status changes via Supabase Realtime and send SMS
 * This should be called from a server-side process or API route
 */
export async function listenForOrderStatusChanges() {
  // Note: Supabase Realtime requires a client connection
  // For server-side, we'll use a polling approach or webhook
  // This function is a placeholder for future implementation
  console.log('[SMS Status Listener] Status change listener initialized')
}

/**
 * Process order status change event and send SMS if needed
 * Called when a status change is detected
 */
export async function processOrderStatusChange(orderId, oldStatus, newStatus) {
  console.log(`[SMS Status Listener] Processing status change: ${orderId} ${oldStatus} -> ${newStatus}`)

  // Récupérer les informations de la commande
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
    console.error('[SMS Status Listener] Erreur lors de la récupération de la commande:', orderError)
    return { success: false, error: orderError.message }
  }

  if (!order) {
    return { success: false, error: 'Commande introuvable' }
  }

  // Déterminer le numéro de téléphone
  let customerPhone = null
  if (order.fulfillment === 'pickup') {
    customerPhone = order.pickup_phone
  } else if (order.fulfillment === 'delivery') {
    customerPhone = order.customer?.phone
  }

  if (!customerPhone) {
    return { success: false, error: 'Numéro de téléphone non disponible' }
  }

  const formattedPhone = formatPhoneForSMS(customerPhone)
  if (!formattedPhone) {
    return { success: false, error: 'Format de numéro invalide' }
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
    return { success: true, skipped: true, reason: 'Aucun message configuré pour ce statut' }
  }

  const result = await sendSMS(formattedPhone, message.trim())
  return result
}

