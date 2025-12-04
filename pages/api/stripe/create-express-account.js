import Stripe from 'stripe'
import { supabaseServer } from '../../../lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
})

/**
 * API route pour créer un compte Express Stripe Connect pour les tests
 * POST /api/stripe/create-express-account
 * Body: { restaurantSlug?: string, email?: string }
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
    const { restaurantSlug, email } = req.body

    // Créer un compte Express Stripe Connect
    // Configuration minimale pour les tests
    const accountParams = {
      type: 'express',
      country: 'CA',
    }

    if (email && typeof email === 'string') {
      accountParams.email = email
    }

    // Demander les capacités de paiement par carte
    accountParams.capabilities = {
      card_payments: { requested: true },
      transfers: { requested: true },
    }

    const account = await stripe.accounts.create(accountParams)

    // Si un restaurantSlug est fourni, associer le compte au restaurant
    if (restaurantSlug && typeof restaurantSlug === 'string') {
      try {
        // Récupérer l'ID du restaurant depuis son slug
        const { data: restaurant, error: restaurantError } = await supabaseServer
          .from('restaurants')
          .select('id')
          .eq('slug', restaurantSlug)
          .maybeSingle()

        if (restaurantError) {
          console.error('Erreur lors de la récupération du restaurant:', restaurantError)
        } else if (restaurant) {
          // Mettre à jour ou créer l'entrée restaurant_settings
          const { error: updateError } = await supabaseServer
            .from('restaurant_settings')
            .upsert({
              restaurant_id: restaurant.id,
              stripe_account_id: account.id,
            }, {
              onConflict: 'restaurant_id',
            })

          if (updateError) {
            console.error('Erreur lors de l\'association du compte au restaurant:', updateError)
          } else {
            console.log(`Compte Stripe Connect ${account.id} associé au restaurant ${restaurantSlug}`)
          }
        }
      } catch (associationError) {
        console.error('Erreur lors de l\'association:', associationError)
        // Ne pas échouer si l'association échoue, on retourne quand même le compte
      }
    }

    // Créer un lien d'onboarding pour compléter la configuration
    let onboardingLink = null
    try {
      const link = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${req.headers.origin || 'http://localhost:3000'}/api/stripe/account-refresh?account_id=${account.id}`,
        return_url: `${req.headers.origin || 'http://localhost:3000'}/api/stripe/account-return?account_id=${account.id}`,
        type: 'account_onboarding',
      })
      onboardingLink = link.url
    } catch (linkError) {
      console.error('Erreur lors de la création du lien d\'onboarding:', linkError)
      // Ne pas échouer si le lien ne peut pas être créé
    }

    return res.status(200).json({
      success: true,
      account: {
        id: account.id,
        type: account.type,
        country: account.country,
        chargesEnabled: account.charges_enabled,
        detailsSubmitted: account.details_submitted,
        email: account.email,
      },
      onboardingLink,
      message: 'Compte Express créé avec succès. Utilisez le lien d\'onboarding pour compléter la configuration.',
      note: 'Le compte doit compléter l\'onboarding avant de pouvoir recevoir des paiements.',
    })
  } catch (error) {
    console.error('Erreur lors de la création du compte Express:', error)
    console.error('Détails de l\'erreur:', {
      message: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode,
    })
    return res.status(500).json({
      error: 'Impossible de créer le compte Express',
      details: error.message,
      type: error.type,
      code: error.code,
    })
  }
}

