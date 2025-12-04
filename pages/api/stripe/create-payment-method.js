import Stripe from 'stripe'
import { getRestaurantStripeAccountIdBySlug } from '../../../lib/stripe/connect'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
})

/**
 * API route pour créer un PaymentMethod sur le compte Stripe Connect
 * POST /api/stripe/create-payment-method
 * Body: { restaurantSlug, paymentMethodData }
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
    const { restaurantSlug, paymentMethodData } = req.body

    if (!paymentMethodData || !paymentMethodData.type) {
      return res.status(400).json({ error: 'Données de PaymentMethod requises' })
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

    // Créer le PaymentMethod
    const paymentMethod = await stripe.paymentMethods.create(
      paymentMethodData,
      requestOptions
    )

    return res.status(200).json({
      id: paymentMethod.id,
      stripeAccountId: stripeAccountId || null,
    })
  } catch (error) {
    console.error('Erreur lors de la création du PaymentMethod:', error)
    return res.status(500).json({
      error: 'Impossible de créer la méthode de paiement',
      details: error.message,
    })
  }
}

