/**
 * Page de rafraîchissement pour l'onboarding Stripe Connect
 * GET /api/stripe/account-refresh?account_id=acct_xxxxx
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

  // Rediriger vers une page de rafraîchissement ou retourner un message
  return res.status(200).json({
    message: 'Rafraîchissement de l\'onboarding',
    accountId: account_id,
    note: 'Vous pouvez continuer l\'onboarding depuis le tableau de bord Stripe',
  })
}

