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
      stripeAccountId = await getRestaurantStripeAccountIdBySlug(restaurantSlug)
      if (stripeAccountId) {
        console.log(`Utilisation du compte Stripe Connect pour le restaurant: ${stripeAccountId}`)
      }
    }

    // Options pour créer le PaymentIntent
    const paymentIntentOptions = {
      amount: amountInCents,
      currency: currency.toLowerCase(),
      metadata: {
        ...metadata,
        // Ajouter le restaurantSlug dans les metadata si disponible
        restaurantSlug: restaurantSlug || metadata.restaurantSlug || null,
      },
      // Mode sandbox - utiliser des cartes de test
      payment_method_types: ['card'],
    }

    // Si un compte Stripe Connect est configuré, créer le PaymentIntent sur ce compte
    // Sinon, créer le PaymentIntent sur le compte principal de la plateforme
    // Avec Stripe Connect, on utilise l'option stripeAccount dans les options de requête
    const requestOptions = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined

    const paymentIntent = await stripe.paymentIntents.create(
      paymentIntentOptions,
      requestOptions
    )

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
    })
  } catch (error) {
    console.error('Erreur lors de la création du PaymentIntent:', error)
    return res.status(500).json({ 
      error: 'Impossible de créer l\'intention de paiement',
      details: error.message 
    })
  }
}

