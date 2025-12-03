import Stripe from 'stripe'

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
    const { amount, currency = 'cad', metadata = {} } = req.body

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Montant invalide' })
    }

    // Convertir le montant en centimes (Stripe utilise les plus petites unités de la devise)
    const amountInCents = Math.round(amount * 100)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      metadata,
      // Mode sandbox - utiliser des cartes de test
      payment_method_types: ['card'],
    })

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

