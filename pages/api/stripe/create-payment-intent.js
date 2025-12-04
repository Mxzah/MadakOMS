import Stripe from 'stripe'
import { getRestaurantStripeAccountIdBySlug } from '../../../lib/stripe/connect'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe n\'est pas configuré. Veuillez définir STRIPE_SECRET_KEY dans les variables d\'environnement.' })
  }

  try {
    const { amount, currency = 'cad', metadata = {}, restaurantSlug } = req.body

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Montant invalide' })
    }

    // Convertir le montant en centimes (Stripe utilise les plus petites unités de la devise)
    const amountInCents = Math.round(amount * 100)

    // Récupérer le compte Stripe Connect du restaurant si disponible
    let stripeAccountId = null
    if (restaurantSlug && typeof restaurantSlug === 'string') {
      const accountId = await getRestaurantStripeAccountIdBySlug(restaurantSlug)
      if (accountId) {
        // Vérifier que le compte est activé pour recevoir des paiements
        try {
          const account = await stripe.accounts.retrieve(accountId)
          if (account.charges_enabled && account.details_submitted) {
            stripeAccountId = accountId
          }
        } catch (accountError) {
          // En cas d'erreur, ne pas utiliser le compte Connect et utiliser le compte principal
        }
      }
    }

    // Calculer l'application fee (frais Stripe : 2.9% + $0.30)
    // Cette fee sera gardée par la plateforme, puis transférée au restaurant
    const stripeFee = Math.round(amountInCents * 0.029 + 30) // 2.9% + $0.30
    const applicationFeeAmount = stripeFee

    // Options pour créer le PaymentIntent
    const paymentIntentOptions = {
      amount: amountInCents,
      currency: currency.toLowerCase(),
      metadata: {
        ...metadata,
        restaurantSlug: restaurantSlug || metadata.restaurantSlug || null,
      },
      payment_method_types: ['card'],
    }

    // Si un compte Stripe Connect est configuré, utiliser Application Fees
    // Sinon, créer le PaymentIntent normalement sur le compte principal
    if (stripeAccountId) {
      paymentIntentOptions.application_fee_amount = applicationFeeAmount
      paymentIntentOptions.transfer_data = {
        destination: stripeAccountId,
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions)

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
      stripeAccountId: stripeAccountId || null,
      applicationFeeAmount: stripeAccountId ? applicationFeeAmount / 100 : null, // En dollars pour référence
    })
  } catch (error) {
    console.error('Erreur lors de la création du PaymentIntent:', error)
    return res.status(500).json({ 
      error: 'Impossible de créer l\'intention de paiement',
      details: error.message 
    })
  }
}

