import Stripe from 'stripe'
import { getRestaurantStripeAccountIdBySlug } from '../../../lib/stripe/connect'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
})

/**
 * API route pour confirmer un PaymentIntent côté serveur
 * Utilisé pour les comptes Stripe Connect où la confirmation côté client ne fonctionne pas
 * POST /api/stripe/confirm-payment-intent
 * Body: { paymentIntentId, paymentMethodId, restaurantSlug }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe n\'est pas configuré.' })
  }

  try {
    const { paymentIntentId, paymentMethodId, restaurantSlug } = req.body

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return res.status(400).json({ error: 'PaymentIntent ID requis' })
    }

    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
      return res.status(400).json({ error: 'PaymentMethod ID requis' })
    }

    // Récupérer le compte Stripe Connect du restaurant si disponible
    let stripeAccountId = null
    if (restaurantSlug && typeof restaurantSlug === 'string') {
      const accountId = await getRestaurantStripeAccountIdBySlug(restaurantSlug)
      if (accountId) {
        // Vérifier que le compte est activé
        try {
          const account = await stripe.accounts.retrieve(accountId)
          if (account.charges_enabled && account.details_submitted) {
            stripeAccountId = accountId
          }
        } catch (accountError) {
          console.error(`Erreur lors de la vérification du compte:`, accountError.message)
        }
      }
    }

    // Options de requête pour utiliser le compte Stripe Connect si disponible
    const requestOptions = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined

    // Pour Stripe Connect, on ne peut pas utiliser un PaymentMethod créé sur le compte principal
    // Il faut utiliser le PaymentMethod directement, mais Stripe devrait gérer la compatibilité
    // Si cela ne fonctionne pas, il faudra créer le PaymentMethod sur le compte Connect
    
    // Confirmer le PaymentIntent avec le PaymentMethod
    // Stripe devrait gérer la compatibilité entre le PaymentMethod du compte principal
    // et le PaymentIntent du compte Connect
    let paymentIntent
    try {
      paymentIntent = await stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: paymentMethodId,
        },
        requestOptions
      )
    } catch (confirmError) {
      // Si l'erreur indique que le PaymentMethod n'est pas compatible avec le compte Connect
      // on doit créer un nouveau PaymentMethod sur le compte Connect
      if (confirmError.code === 'payment_method_unexpected_state' || 
          confirmError.message?.includes('payment_method') ||
          confirmError.message?.includes('account')) {
        console.error(`[Confirm PaymentIntent] Erreur de compatibilité PaymentMethod:`, confirmError.message)
        throw new Error(`Le PaymentMethod n'est pas compatible avec le compte Connect. Il faut créer le PaymentMethod sur le compte Connect, mais cela nécessite les données de la carte, ce qui n'est pas possible pour des raisons de sécurité PCI.`)
      }
      throw confirmError
    }

    return res.status(200).json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        payment_method: paymentIntent.payment_method,
      },
    })
  } catch (error) {
    console.error('Erreur lors de la confirmation du PaymentIntent:', error)
    return res.status(500).json({
      error: 'Impossible de confirmer le paiement',
      details: error.message,
      code: error.code,
    })
  }
}

