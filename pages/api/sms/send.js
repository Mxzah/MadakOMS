import { sendSMS, formatPhoneForSMS } from '../../../lib/sms/send'

/**
 * API route to send SMS notifications
 * POST /api/sms/send
 * Body: { to: string, message: string }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    const { to, message } = req.body

    if (!to || typeof to !== 'string') {
      return res.status(400).json({ error: 'Numéro de téléphone requis' })
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message requis' })
    }

    const formattedPhone = formatPhoneForSMS(to)
    if (!formattedPhone) {
      return res.status(400).json({ error: 'Format de numéro de téléphone invalide' })
    }

    const result = await sendSMS(formattedPhone, message)

    if (!result.success) {
      return res.status(500).json({
        error: 'Impossible d\'envoyer le SMS',
        details: result.error,
      })
    }

    return res.status(200).json({
      success: true,
      message: 'SMS envoyé avec succès',
      sid: result.sid,
    })
  } catch (error) {
    console.error('[SMS API] Erreur inattendue:', error)
    return res.status(500).json({
      error: 'Erreur interne du serveur',
      details: error.message,
    })
  }
}

