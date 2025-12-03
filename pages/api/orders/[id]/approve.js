import { advanceOrderStatus, fetchOrderForTracking, OrderValidationError } from '../../../../lib/db/orders'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    const { id: orderId } = req.query

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'ID de commande requis' })
    }

    // advanceOrderStatus vérifie et confirme automatiquement le paiement
    // avant de passer à "preparing". Si le paiement échoue, la commande est annulée.
    await advanceOrderStatus(orderId)
    
    const order = await fetchOrderForTracking(orderId)
    
    return res.status(200).json({
      success: true,
      order,
      message: 'Commande approuvée avec succès',
    })
  } catch (error) {
    console.error('Erreur lors de l\'approbation de la commande:', error)
    
    if (error instanceof OrderValidationError) {
      // Si le paiement a échoué, advanceOrderStatus a déjà annulé la commande
      return res.status(error.statusCode || 400).json({
        error: error.message,
        orderCancelled: error.statusCode === 402, // 402 = Payment Required
      })
    }
    
    return res.status(500).json({
      error: 'Impossible d\'approuver la commande',
      details: error.message,
    })
  }
}

