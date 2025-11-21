import { createOrder, OrderValidationError } from '../../../../lib/db/orders'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { slug } = req.query
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug requis' })
  }

  try {
    const order = await createOrder(slug, req.body || {})
    return res.status(201).json(order)
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return res.status(error.statusCode || 400).json({ error: error.message })
    }
    console.error('Order submission error:', error)
    return res.status(500).json({ error: 'Impossible de créer la commande' })
  }
}
