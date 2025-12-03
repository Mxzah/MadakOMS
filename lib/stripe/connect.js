import { supabaseServer } from '../supabase/server'

/**
 * Récupère le stripe_account_id d'un restaurant depuis la base de données
 * @param {string} restaurantId - L'ID UUID du restaurant
 * @returns {Promise<string|null>} - L'ID du compte Stripe Connect ou null si non configuré
 */
export async function getRestaurantStripeAccountId(restaurantId) {
  if (!restaurantId || typeof restaurantId !== 'string') {
    return null
  }

  try {
    const { data, error } = await supabaseServer
      .from('restaurant_settings')
      .select('stripe_account_id')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    if (error) {
      console.error('Erreur lors de la récupération du stripe_account_id:', error)
      return null
    }

    // Retourner l'ID du compte Stripe Connect s'il existe, sinon null
    // Si null, le système utilisera le compte Stripe principal de la plateforme
    return data?.stripe_account_id || null
  } catch (error) {
    console.error('Erreur lors de la récupération du stripe_account_id:', error)
    return null
  }
}

/**
 * Récupère le stripe_account_id d'un restaurant depuis son slug
 * @param {string} slug - Le slug du restaurant
 * @returns {Promise<string|null>} - L'ID du compte Stripe Connect ou null si non configuré
 */
export async function getRestaurantStripeAccountIdBySlug(slug) {
  if (!slug || typeof slug !== 'string') {
    return null
  }

  try {
    // D'abord récupérer l'ID du restaurant depuis son slug
    const { data: restaurant, error: restaurantError } = await supabaseServer
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (restaurantError || !restaurant) {
      console.error('Erreur lors de la récupération du restaurant:', restaurantError)
      return null
    }

    // Ensuite récupérer le stripe_account_id
    return await getRestaurantStripeAccountId(restaurant.id)
  } catch (error) {
    console.error('Erreur lors de la récupération du stripe_account_id par slug:', error)
    return null
  }
}

/**
 * Récupère le stripe_account_id d'un restaurant depuis l'ID d'une commande
 * @param {string} orderId - L'ID UUID de la commande
 * @returns {Promise<string|null>} - L'ID du compte Stripe Connect ou null si non configuré
 */
export async function getRestaurantStripeAccountIdByOrderId(orderId) {
  if (!orderId || typeof orderId !== 'string') {
    return null
  }

  try {
    // Récupérer le restaurant_id depuis la commande
    const { data: order, error: orderError } = await supabaseServer
      .from('orders')
      .select('restaurant_id')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError || !order) {
      console.error('Erreur lors de la récupération de la commande:', orderError)
      return null
    }

    // Récupérer le stripe_account_id du restaurant
    return await getRestaurantStripeAccountId(order.restaurant_id)
  } catch (error) {
    console.error('Erreur lors de la récupération du stripe_account_id par orderId:', error)
    return null
  }
}

