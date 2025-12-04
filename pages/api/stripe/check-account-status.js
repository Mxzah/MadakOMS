import Stripe from 'stripe'
import { getRestaurantStripeAccountIdBySlug } from '../../../lib/stripe/connect'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
})

/**
 * API route pour vérifier le statut d'un compte Stripe Connect
 * GET /api/stripe/check-account-status?restaurantSlug=sante-taouk
 * ou
 * GET /api/stripe/check-account-status?accountId=acct_xxxxx
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe n\'est pas configuré.' })
  }

  try {
    const { restaurantSlug, accountId } = req.query

    let accountIdToCheck = accountId

    // Si restaurantSlug est fourni, récupérer le compte associé
    if (restaurantSlug && !accountId) {
      accountIdToCheck = await getRestaurantStripeAccountIdBySlug(restaurantSlug)
      if (!accountIdToCheck) {
        return res.status(404).json({
          error: 'Aucun compte Stripe Connect trouvé pour ce restaurant',
          restaurantSlug,
        })
      }
    }

    if (!accountIdToCheck) {
      return res.status(400).json({
        error: 'accountId ou restaurantSlug requis',
      })
    }

    // Récupérer les détails du compte
    const account = await stripe.accounts.retrieve(accountIdToCheck)

    const isActive = account.charges_enabled && account.details_submitted
    const canAcceptPayments = isActive && account.capabilities?.card_payments === 'active'

    return res.status(200).json({
      account: {
        id: account.id,
        type: account.type,
        country: account.country,
        email: account.email,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        capabilities: account.capabilities,
      },
      status: {
        isActive,
        canAcceptPayments,
        message: canAcceptPayments
          ? 'Le compte est activé et peut recevoir des paiements'
          : isActive
          ? 'Le compte est activé mais les paiements par carte ne sont pas encore actifs'
          : 'Le compte n\'est pas encore activé. Complétez l\'onboarding.',
      },
      requirements: {
        currentlyDue: account.requirements?.currently_due || [],
        pastDue: account.requirements?.past_due || [],
      },
    })
  } catch (error) {
    console.error('Erreur lors de la vérification du compte:', error)
    return res.status(500).json({
      error: 'Impossible de vérifier le compte',
      details: error.message,
    })
  }
}

