import Stripe from 'stripe'
import { getRestaurantStripeAccountIdBySlug, getRestaurantStripeAccountIdByOrderId } from '../../../lib/stripe/connect'
import { supabaseServer } from '../../../lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
})

/**
 * API route pour transférer les fonds d'un paiement vers le compte Stripe Connect du restaurant
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

    // Vérifier si un transfer a déjà été effectué
    // On stocke le transfer_id dans metadata.transfer_id
    if (payment.metadata && typeof payment.metadata === 'object' && payment.metadata.transfer_id) {
      return res.status(200).json({
        success: true,
        message: 'Transfer déjà effectué',
        transferId: payment.metadata.transfer_id,
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

    // Récupérer le PaymentIntent pour obtenir le charge ID
    const paymentIntentId = payment.processor_id
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'PaymentIntent ID manquant' })
    }

    let paymentIntent
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    } catch (retrieveError) {
      console.error('[Transfer] Erreur lors de la récupération du PaymentIntent:', retrieveError)
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

    // Récupérer le charge ID depuis le PaymentIntent
    const chargeId = paymentIntent.latest_charge
    if (!chargeId || typeof chargeId !== 'string') {
      return res.status(400).json({ error: 'Charge ID introuvable dans le PaymentIntent' })
    }

    // Calculer le montant à transférer (en centimes)
    // Pour l'instant, on transfère 100% du montant. Vous pouvez ajuster cela pour prendre une commission.
    const transferAmount = Math.round(payment.amount * 100) // payment.amount est en dollars, on le convertit en centimes

    // Effectuer le transfer vers le compte Connect
    let transfer
    try {
      transfer = await stripe.transfers.create({
        amount: transferAmount,
        currency: 'cad',
        destination: stripeAccountId,
        source_transaction: chargeId, // Utiliser le charge pour le transfer direct
        metadata: {
          order_id: orderId,
          payment_intent_id: paymentIntentId,
          charge_id: chargeId,
        },
      })

      // Mettre à jour le paiement dans la base de données pour enregistrer le transfer
      const { error: updateError } = await supabaseServer
        .from('payments')
        .update({
          metadata: {
            transfer_id: transfer.id,
            transfer_amount: transferAmount,
            transfer_destination: stripeAccountId,
            transferred_at: new Date().toISOString(),
          },
        })
        .eq('id', payment.id)

      if (updateError) {
        console.error('[Transfer] Erreur lors de la mise à jour du paiement:', updateError)
        // Ne pas échouer si la mise à jour échoue, le transfer est déjà effectué
      }

      return res.status(200).json({
        success: true,
        transfer: {
          id: transfer.id,
          amount: transferAmount / 100, // Convertir en dollars
          currency: transfer.currency,
          destination: transfer.destination,
          status: transfer.status,
        },
        message: 'Transfer effectué avec succès',
      })
    } catch (transferError) {
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

