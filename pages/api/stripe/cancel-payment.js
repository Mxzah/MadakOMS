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
    if (stripeAccountId) {
      console.log(`Utilisation du compte Stripe Connect pour l'annulation: ${stripeAccountId}`)
    }

    // Récupérer le paiement associé à la commande
    const { data: payment, error: paymentError } = await supabaseServer
      .from('payments')
      .select('id, processor_id, status, amount')
      .eq('order_id', orderId)
      .eq('processor', 'stripe')
      .maybeSingle()

    if (paymentError) {
      console.error('Erreur lors de la récupération du paiement:', paymentError)
      return res.status(500).json({ error: 'Impossible de récupérer le paiement' })
    }

    if (!payment) {
      return res.status(404).json({ error: 'Paiement Stripe introuvable pour cette commande' })
    }

    const paymentIntentId = payment.processor_id
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'PaymentIntent ID manquant' })
    }

    // Options de requête pour utiliser le compte Stripe Connect si disponible
    const requestOptions = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined

    // Récupérer le PaymentIntent depuis Stripe (sur le bon compte)
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {}, requestOptions)

    let result = {}

    // Déterminer l'action à effectuer basée sur le statut réel du PaymentIntent dans Stripe
    // Le statut dans la BD peut ne pas être à jour, donc on se base sur Stripe
    if (paymentIntent.status === 'succeeded') {
      // Le paiement a été confirmé et capturé - vérifier d'abord s'il y a déjà un remboursement
      const existingRefunds = await stripe.refunds.list({
        payment_intent: paymentIntentId,
        limit: 10, // Récupérer tous les remboursements pour vérifier
      }, requestOptions)
      
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
        // Créer un remboursement pour le montant restant
        const remainingAmount = paymentAmountCents - totalRefunded
        try {
          const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: remainingAmount,
            reason: 'requested_by_customer', // Raison du remboursement
          }, requestOptions)
          result = {
            action: 'refunded',
            refundId: refund.id,
            status: refund.status,
            amount: refund.amount / 100, // Convertir en dollars
            totalRefunded: (totalRefunded + refund.amount) / 100, // Montant total remboursé
          }
        } catch (refundError) {
          console.error('Erreur lors de la création du remboursement:', refundError)
          throw refundError
        }
      }
    } else if (paymentIntent.status === 'requires_capture') {
      // Le paiement est autorisé mais pas encore capturé - annuler le PaymentIntent
      // Cela libère les fonds sans créer de remboursement
      const cancelled = await stripe.paymentIntents.cancel(paymentIntentId, {}, requestOptions)
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
        const cancelled = await stripe.paymentIntents.cancel(paymentIntentId, {}, requestOptions)
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
          }, requestOptions)
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
    
    const { error: updateError } = await supabaseServer
      .from('payments')
      .update({
        status: newStatus,
      })
      .eq('id', payment.id)

    if (updateError) {
      console.error('Erreur lors de la mise à jour du paiement:', updateError)
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
    console.error('Erreur lors de l\'annulation/remboursement du paiement:', error)
    return res.status(500).json({ 
      error: 'Impossible d\'annuler/rembourser le paiement',
      details: error.message 
    })
  }
}

