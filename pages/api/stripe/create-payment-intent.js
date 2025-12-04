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

    // NOTE: Pour l'instant, on n'utilise pas le compte Connect pour les paiements directs
    // car un PaymentMethod créé sur le compte principal ne peut pas être utilisé avec
    // un PaymentIntent créé sur le compte Connect.
    // 
    // Solution future: Collecter les paiements sur le compte principal et transférer
    // les fonds au compte Connect après via Stripe Transfers.
    //
    // Pour l'instant, tous les paiements sont collectés sur le compte principal.
    let stripeAccountId = null
    
    // TODO: Implémenter les transfers vers le compte Connect après la collecte des paiements
    // if (restaurantSlug && typeof restaurantSlug === 'string') {
    //   const accountId = await getRestaurantStripeAccountIdBySlug(restaurantSlug)
    //   if (accountId) {
    //     // Vérifier que le compte est activé pour recevoir des paiements
    //     try {
    //       const account = await stripe.accounts.retrieve(accountId)
    //       if (account.charges_enabled && account.details_submitted) {
    //         stripeAccountId = accountId
    //         console.log(`Utilisation du compte Stripe Connect activé pour le restaurant: ${stripeAccountId}`)
    //       } else {
    //         console.warn(`Le compte Stripe Connect ${accountId} n'est pas activé (charges_enabled: ${account.charges_enabled}, details_submitted: ${account.details_submitted}). Utilisation du compte principal.`)
    //       }
    //     } catch (accountError) {
    //       console.error(`Erreur lors de la vérification du compte Stripe Connect ${accountId}:`, accountError.message)
    //       // En cas d'erreur, ne pas utiliser le compte Connect et utiliser le compte principal
    //     }
    //   }
    // }

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
      stripeAccountId: stripeAccountId || null, // Inclure l'account ID pour déboguer
    })
  } catch (error) {
    console.error('Erreur lors de la création du PaymentIntent:', error)
    return res.status(500).json({ 
      error: 'Impossible de créer l\'intention de paiement',
      details: error.message 
    })
  }
}

