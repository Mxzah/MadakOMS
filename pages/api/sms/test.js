import { sendSMS, formatPhoneForSMS } from '../../../lib/sms/send'

/**
 * API route to test SMS sending
 * POST /api/sms/test
 * Body: { to: string }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    const { to } = req.body

    if (!to || typeof to !== 'string') {
      return res.status(400).json({ error: 'Numéro de téléphone requis' })
    }

    // Vérifier les variables d'environnement
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    const configStatus = {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasFromNumber: !!fromNumber,
      accountSidLength: accountSid?.length || 0,
      fromNumber: fromNumber || 'NON CONFIGURÉ',
    }

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(500).json({
        error: 'Twilio n\'est pas configuré correctement',
        config: configStatus,
        message: 'Vérifiez que toutes les variables d\'environnement sont définies dans .env.local et que le serveur a été redémarré.',
      })
    }

    const formattedPhone = formatPhoneForSMS(to)
    if (!formattedPhone) {
      return res.status(400).json({
        error: 'Format de numéro de téléphone invalide',
        provided: to,
        message: 'Le numéro doit être au format nord-américain (10 chiffres) ou E.164 (+1XXXXXXXXXX)',
      })
    }

    const testMessage = `Test SMS depuis MadakOMS - ${new Date().toLocaleString('fr-CA')}`

    const result = await sendSMS(formattedPhone, testMessage)

    if (!result.success) {
      return res.status(500).json({
        error: 'Erreur lors de l\'envoi du SMS',
        details: result.error,
        config: configStatus,
        formattedPhone,
        message: 'Vérifiez les logs du serveur pour plus de détails. Si vous utilisez un compte d\'essai Twilio, assurez-vous que le numéro de destination est vérifié dans Twilio.',
      })
    }

    return res.status(200).json({
      success: true,
      message: 'SMS envoyé avec succès',
      sid: result.sid,
      config: configStatus,
      formattedPhone,
      sentTo: formattedPhone,
      sentFrom: fromNumber,
    })
  } catch (error) {
    console.error('[SMS Test] Erreur inattendue:', error)
    return res.status(500).json({
      error: 'Erreur interne du serveur',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
}

