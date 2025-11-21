import { advanceOrderStatus, fetchOrderForTracking, OrderValidationError } from '../../../../lib/db/orders'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Méthode non autorisée.' })
  }

  const { id } = req.query
  const orderId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : ''

  if (!orderId) {
    return res.status(400).json({ error: 'Identifiant de commande manquant.' })
  }

  try {
    await advanceOrderStatus(orderId)
    const order = await fetchOrderForTracking(orderId)
    return res.status(200).json({ order })
  } catch (error) {
    console.error('Order simulation error:', error)
    if (error instanceof OrderValidationError) {
      return res.status(error.statusCode || 400).json({ error: error.message })
    }
    return res.status(500).json({ error: 'Impossible de simuler la commande.' })
  }
}
