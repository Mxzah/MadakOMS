import { fetchOrderForTracking, OrderValidationError } from '../../../lib/db/orders'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Méthode non autorisée.' })
  }

  const { id } = req.query

  try {
    const order = await fetchOrderForTracking(typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '')
    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable.' })
    }
    return res.status(200).json(order)
  } catch (error) {
    console.error('Order tracking fetch error:', error)
    if (error instanceof OrderValidationError) {
      return res.status(error.statusCode || 400).json({ error: error.message })
    }
    return res.status(500).json({ error: 'Impossible de récupérer la commande.' })
  }
}
