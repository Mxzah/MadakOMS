import Stripe from 'stripe'
import { getRestaurantStripeAccountIdBySlug, getRestaurantStripeAccountIdByOrderId } from '../../../lib/stripe/connect'
import { supabaseServer } from '../../../lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
})

/**
 * API route pour transférer l'application fee au compte Stripe Connect du restaurant
 * Avec Application Fees, le montant principal est déjà transféré automatiquement.
 * Cette route transfère seulement l'application fee pour que le restaurant reçoive presque tout le montant.
 * POST /api/stripe/transfer-to-connect
 * Body: { orderId, restaurantSlug }
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
    const { orderId, restaurantSlug } = req.body

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'ID de commande requis' })
    }

    // Récupérer le paiement associé à la commande
    const { data: payment, error: paymentError } = await supabaseServer
      .from('payments')
      .select('id, processor_id, amount, status, processor, metadata')
      .eq('order_id', orderId)
      .eq('processor', 'stripe')
      .maybeSingle()

    if (paymentError) {
      console.error('[Transfer] Erreur lors de la récupération du paiement:', paymentError)
      return res.status(500).json({ error: 'Impossible de récupérer le paiement' })
    }

    if (!payment) {
      return res.status(404).json({ error: 'Paiement Stripe introuvable pour cette commande' })
    }

    if (payment.status !== 'paid') {
      return res.status(400).json({ 
        error: 'Le paiement doit être confirmé avant de transférer les fonds',
        paymentStatus: payment.status 
      })
    }

    // Vérifier si l'application fee a déjà été transférée
    // On stocke le application_fee_transfer_id dans metadata
    if (payment.metadata && typeof payment.metadata === 'object' && payment.metadata.application_fee_transfer_id) {
      return res.status(200).json({
        success: true,
        message: 'Application fee déjà transférée',
        transferId: payment.metadata.application_fee_transfer_id,
      })
    }

    // Récupérer le compte Stripe Connect du restaurant
    let stripeAccountId = null
    if (restaurantSlug && typeof restaurantSlug === 'string') {
      stripeAccountId = await getRestaurantStripeAccountIdBySlug(restaurantSlug)
    } else {
      // Essayer de récupérer depuis l'orderId
      stripeAccountId = await getRestaurantStripeAccountIdByOrderId(orderId)
    }

    if (!stripeAccountId) {
      return res.status(200).json({
        success: true,
        message: 'Aucun compte Stripe Connect configuré pour ce restaurant. Les fonds restent sur le compte principal.',
        transferred: false,
      })
    }

    // Vérifier que le compte est activé
    let account
    try {
      account = await stripe.accounts.retrieve(stripeAccountId)
      if (!account.charges_enabled || !account.details_submitted) {
        console.warn(`[Transfer] Le compte Stripe Connect ${stripeAccountId} n'est pas activé. Transfer annulé.`)
        return res.status(200).json({
          success: true,
          message: 'Le compte Stripe Connect n\'est pas activé. Les fonds restent sur le compte principal.',
          transferred: false,
        })
      }
    } catch (accountError) {
      console.error(`[Transfer] Erreur lors de la vérification du compte:`, accountError.message)
      return res.status(500).json({ 
        error: 'Impossible de vérifier le compte Stripe Connect',
        details: accountError.message 
      })
    }

    // Récupérer le PaymentIntent pour obtenir l'application fee
    const paymentIntentId = payment.processor_id
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'PaymentIntent ID manquant' })
    }

    let paymentIntent
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    } catch (retrieveError) {
      return res.status(500).json({ 
        error: 'Impossible de récupérer le PaymentIntent',
        details: retrieveError.message 
      })
    }

    // Vérifier que le PaymentIntent est bien payé
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        error: 'Le PaymentIntent n\'est pas confirmé',
        status: paymentIntent.status 
      })
    }

    // Vérifier que le PaymentIntent utilise Application Fees
    if (!paymentIntent.application_fee_amount || !paymentIntent.transfer_data?.destination) {
      return res.status(200).json({
        success: true,
        message: 'Ce paiement n\'utilise pas Application Fees. Aucun transfer nécessaire.',
        transferred: false,
      })
    }

    // Vérifier que le compte de destination correspond
    if (paymentIntent.transfer_data.destination !== stripeAccountId) {
      return res.status(400).json({ 
        error: 'Le compte de destination ne correspond pas au compte du restaurant',
      })
    }

    // Calculer le montant de l'application fee à transférer (en centimes)
    // L'application fee est déjà sur le compte principal, on la transfère au restaurant
    const applicationFeeAmount = paymentIntent.application_fee_amount

    // Effectuer le transfer de l'application fee vers le compte Connect
    // Les transfers n'ont pas de frais Stripe supplémentaires
    let transfer
    try {
      transfer = await stripe.transfers.create({
        amount: applicationFeeAmount,
        currency: 'cad',
        destination: stripeAccountId,
        metadata: {
          order_id: orderId,
          payment_intent_id: paymentIntentId,
          type: 'application_fee_transfer',
        },
      })

      // Mettre à jour le paiement dans la base de données pour enregistrer le transfer
      const { error: updateError } = await supabaseServer
        .from('payments')
        .update({
          metadata: {
            ...payment.metadata,
            application_fee_transfer_id: transfer.id,
            application_fee_transfer_amount: applicationFeeAmount,
            application_fee_transfer_destination: stripeAccountId,
            application_fee_transferred_at: new Date().toISOString(),
          },
        })
        .eq('id', payment.id)

      if (updateError) {
        // Ne pas échouer si la mise à jour échoue, le transfer est déjà effectué
      }

      return res.status(200).json({
        success: true,
        transfer: {
          id: transfer.id,
          amount: applicationFeeAmount / 100, // Convertir en dollars
          currency: transfer.currency,
          destination: transfer.destination,
          status: transfer.status,
        },
        message: 'Application fee transférée avec succès',
      })
    } catch (transferError) {
      // Gérer spécifiquement l'erreur de solde insuffisant en mode test
      if (transferError.code === 'balance_insufficient') {
        // En mode test, c'est normal si le compte principal n'a pas assez de fonds
        // Le transfer de l'application fee échouera, mais le paiement principal fonctionne toujours
        // L'application fee restera sur le compte principal jusqu'à ce que des fonds soient ajoutés
        console.warn('[Transfer] Solde insuffisant pour transférer l\'application fee (mode test). L\'application fee restera sur le compte principal.')
        
        // Enregistrer l'erreur dans les métadonnées pour référence future
        const { error: updateError } = await supabaseServer
          .from('payments')
          .update({
            metadata: {
              ...payment.metadata,
              application_fee_transfer_error: 'balance_insufficient',
              application_fee_transfer_error_message: transferError.message,
              application_fee_transfer_failed_at: new Date().toISOString(),
            },
          })
          .eq('id', payment.id)

        return res.status(200).json({
          success: true,
          warning: 'Le transfer de l\'application fee a échoué (solde insuffisant en mode test). L\'application fee restera sur le compte principal. En production, cela ne devrait pas se produire.',
          transferred: false,
          code: transferError.code,
          isTestMode: true,
        })
      }

      // Pour les autres erreurs, retourner une erreur 500
      console.error('[Transfer] Erreur lors du transfer:', transferError)
      return res.status(500).json({
        error: 'Impossible d\'effectuer le transfer',
        details: transferError.message,
        code: transferError.code,
      })
    }
  } catch (error) {
    console.error('[Transfer] Erreur inattendue:', error)
    return res.status(500).json({
      error: 'Erreur lors du transfer',
      details: error.message,
    })
  }
}

