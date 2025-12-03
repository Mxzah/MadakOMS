import Stripe from 'stripe'
import { supabaseServer } from '../../../lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
})

/**
 * NOTE: Cette API route n'est plus utilisée dans le flux principal.
 * Le paiement est maintenant confirmé côté client avant la création de la commande
 * (avec gestion automatique du 3D Secure).
 * Cette route est conservée pour compatibilité ou cas d'usage spécifiques.
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
    const { orderId } = req.body

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'ID de commande requis' })
    }

    // Récupérer le paiement associé à la commande
    const { data: payment, error: paymentError } = await supabaseServer
      .from('payments')
      .select('id, processor_id, auth_code, amount, status')
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

    if (payment.status === 'paid') {
      return res.status(200).json({ 
        message: 'Paiement déjà confirmé',
        paymentIntentId: payment.processor_id 
      })
    }

    const paymentIntentId = payment.processor_id
    const paymentMethodId = payment.auth_code // PaymentMethod ID stocké dans auth_code

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'PaymentIntent ID manquant' })
    }

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'PaymentMethod ID manquant' })
    }

    // Confirmer le PaymentIntent avec le PaymentMethod
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    })

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        error: 'Le paiement n\'a pas pu être confirmé',
        status: paymentIntent.status 
      })
    }

    // Mettre à jour le statut du paiement dans la base de données
    const { error: updateError } = await supabaseServer
      .from('payments')
      .update({
        status: 'paid',
        captured_at: new Date().toISOString(),
      })
      .eq('id', payment.id)

    if (updateError) {
      console.error('Erreur lors de la mise à jour du paiement:', updateError)
      return res.status(500).json({ error: 'Paiement confirmé mais erreur lors de la mise à jour' })
    }

    return res.status(200).json({
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    })
  } catch (error) {
    console.error('Erreur lors de la confirmation du paiement:', error)
    return res.status(500).json({ 
      error: 'Impossible de confirmer le paiement',
      details: error.message 
    })
  }
}

