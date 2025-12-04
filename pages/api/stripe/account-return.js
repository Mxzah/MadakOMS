/**
 * Page de retour après l'onboarding Stripe Connect
 * GET /api/stripe/account-return?account_id=acct_xxxxx
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { account_id } = req.query

  if (!account_id) {
    return res.status(400).json({ error: 'account_id manquant' })
  }

  // Rediriger vers une page de succès ou retourner un message
  return res.status(200).json({
    success: true,
    message: 'Onboarding complété avec succès',
    accountId: account_id,
    nextSteps: [
      'Vérifiez que charges_enabled est true dans le tableau de bord Stripe',
      'Le compte sera automatiquement utilisé pour les nouveaux paiements',
    ],
  })
}

