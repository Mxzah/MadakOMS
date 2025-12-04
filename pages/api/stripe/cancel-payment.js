import Stripe from 'stripe'
import { supabaseServer } from '../../../lib/supabase/server'
import { getRestaurantStripeAccountIdByOrderId } from '../../../lib/stripe/connect'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe n\'est pas configuré.' })
  }

  try {
    const { orderId } = req.body

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'ID de commande requis' })
    }

    // Récupérer le compte Stripe Connect du restaurant associé à cette commande
    const stripeAccountId = await getRestaurantStripeAccountIdByOrderId(orderId)

    // Récupérer le paiement associé à la commande (avec métadonnées pour vérifier les transfers)
    const { data: payment, error: paymentError } = await supabaseServer
      .from('payments')
      .select('id, processor_id, status, amount, metadata')
      .eq('order_id', orderId)
      .eq('processor', 'stripe')
      .maybeSingle()

    if (paymentError) {
      return res.status(500).json({ error: 'Impossible de récupérer le paiement' })
    }

    if (!payment) {
      return res.status(404).json({ error: 'Paiement Stripe introuvable pour cette commande' })
    }

    const paymentIntentId = payment.processor_id
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'PaymentIntent ID manquant' })
    }

    // Récupérer le PaymentIntent pour vérifier s'il utilise Application Fees
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    
    // Vérifier si le PaymentIntent utilise Application Fees
    const usesApplicationFees = paymentIntent.application_fee_amount && paymentIntent.transfer_data?.destination

    let result = {}

    // Déterminer l'action à effectuer basée sur le statut réel du PaymentIntent dans Stripe
    // Le statut dans la BD peut ne pas être à jour, donc on se base sur Stripe
    // IMPORTANT: Tous les paiements sont sur le compte principal, donc on n'utilise pas requestOptions
    if (paymentIntent.status === 'succeeded') {
      // Le paiement a été confirmé et capturé - vérifier d'abord s'il y a déjà un remboursement
      const existingRefunds = await stripe.refunds.list({
        payment_intent: paymentIntentId,
        limit: 10, // Récupérer tous les remboursements pour vérifier
      })
      
      // Vérifier s'il y a un remboursement complet (montant égal ou supérieur au paiement)
      const totalRefunded = existingRefunds.data?.reduce((sum, r) => sum + r.amount, 0) || 0
      const paymentAmountCents = Math.round(payment.amount * 100)
      
      if (totalRefunded >= paymentAmountCents) {
        // Un remboursement complet existe déjà
        const latestRefund = existingRefunds.data?.[0]
        result = {
          action: 'already_refunded',
          refundId: latestRefund?.id,
          status: latestRefund?.status || 'succeeded',
          amount: totalRefunded / 100,
        }
      } else {
        // Créer un remboursement pour le montant restant depuis le compte principal
        const remainingAmount = paymentAmountCents - totalRefunded
        try {
          // Si le PaymentIntent utilise Application Fees, utiliser reverse_transfer: true
          // Cela reverse automatiquement l'application fee et le transfer principal
          const refundOptions = {
            payment_intent: paymentIntentId,
            amount: remainingAmount,
            reason: 'requested_by_customer',
          }
          
          // Avec Application Fees, reverse_transfer reverse automatiquement les transfers
          if (usesApplicationFees) {
            refundOptions.reverse_transfer = true
          }
          
          const refund = await stripe.refunds.create(refundOptions)
          result = {
            action: 'refunded',
            refundId: refund.id,
            status: refund.status,
            amount: refund.amount / 100, // Convertir en dollars
            totalRefunded: (totalRefunded + refund.amount) / 100, // Montant total remboursé
            reverseTransfer: usesApplicationFees,
          }
        } catch (refundError) {
          throw refundError
        }
      }
    } else if (paymentIntent.status === 'requires_capture') {
      // Le paiement est autorisé mais pas encore capturé - annuler le PaymentIntent
      // Cela libère les fonds sans créer de remboursement
      const cancelled = await stripe.paymentIntents.cancel(paymentIntentId)
      result = {
        action: 'cancelled',
        paymentIntentId: cancelled.id,
        status: cancelled.status,
      }
    } else if (paymentIntent.status === 'canceled' || paymentIntent.status === 'requires_payment_method') {
      // Le paiement est déjà annulé ou n'a jamais été confirmé
      result = {
        action: 'already_cancelled',
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      }
    } else {
      // Autres statuts - essayer d'annuler quand même
      try {
        const cancelled = await stripe.paymentIntents.cancel(paymentIntentId)
        result = {
          action: 'cancelled',
          paymentIntentId: cancelled.id,
          status: cancelled.status,
        }
      } catch (cancelError) {
        // Si on ne peut pas annuler, vérifier s'il y a un remboursement
        if (paymentIntent.status === 'succeeded') {
          // Essayer un remboursement en dernier recours
          const refunds = await stripe.refunds.list({
            payment_intent: paymentIntentId,
            limit: 1,
          })
          if (refunds.data && refunds.data.length > 0) {
            result = {
              action: 'already_refunded',
              refundId: refunds.data[0].id,
              status: refunds.data[0].status,
              amount: refunds.data[0].amount / 100,
            }
          } else {
            throw cancelError
          }
        } else {
          throw cancelError
        }
      }
    }

    // Mettre à jour le statut du paiement dans la base de données
    let newStatus = 'failed'
    if (result.action === 'refunded' || result.action === 'already_refunded') {
      newStatus = 'refunded'
    } else if (result.action === 'cancelled' || result.action === 'already_cancelled') {
      newStatus = 'failed'
    }
    
    // Mettre à jour les métadonnées pour enregistrer le remboursement
    const updatedMetadata = {
      ...payment.metadata,
      refunded_at: new Date().toISOString(),
    }
    
    if (usesApplicationFees && result.action === 'refunded') {
      updatedMetadata.refund_reverse_transfer = true
    }
    
    const { error: updateError } = await supabaseServer
      .from('payments')
      .update({
        status: newStatus,
        metadata: updatedMetadata,
      })
      .eq('id', payment.id)

    if (updateError) {
      // Ne pas échouer si le remboursement/annulation a réussi
      // On retourne quand même le succès car l'action principale a été effectuée
      return res.status(200).json({ 
        success: true,
        warning: 'Paiement remboursé/annulé mais erreur lors de la mise à jour du statut',
        ...result 
      })
    }

    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (error) {
    return res.status(500).json({ 
      error: 'Impossible d\'annuler/rembourser le paiement',
      details: error.message 
    })
  }
}

