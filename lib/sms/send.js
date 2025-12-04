/**
 * Helper function to send SMS notifications using Twilio
 * 
 * @param {string} to - Phone number to send SMS to (E.164 format, e.g., +14155552671)
 * @param {string} message - Message content
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendSMS(to, message) {
  // Twilio credentials from environment variables
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.error('[SMS] Twilio n\'est pas configuré. Variables d\'environnement manquantes.')
    return { success: false, error: 'SMS service not configured' }
  }

  if (!to || !message) {
    console.error('[SMS] Numéro de téléphone ou message manquant.')
    return { success: false, error: 'Phone number or message missing' }
  }

  try {
    // Import Twilio client dynamically (only if needed)
    const twilio = (await import('twilio')).default
    const client = twilio(accountSid, authToken)

    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: to,
    })

    console.log(`[SMS] Message envoyé avec succès à ${to}. SID: ${result.sid}`)
    return { success: true, sid: result.sid }
  } catch (error) {
    console.error('[SMS] Erreur lors de l\'envoi du SMS:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Format phone number to E.164 format (required by Twilio)
 * @param {string} phone - Phone number in any format
 * @returns {string|null} - Formatted phone number or null if invalid
 */
export function formatPhoneForSMS(phone) {
  if (!phone || typeof phone !== 'string') return null

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // If it starts with 1 and has 11 digits, assume it's already in North American format
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  // If it has 10 digits, assume it's a North American number without country code
  if (digits.length === 10) {
    return `+1${digits}`
  }

  // If it already starts with +, return as is (assuming it's already in E.164)
  if (phone.trim().startsWith('+')) {
    return phone.trim()
  }

  // Otherwise, return null (invalid format)
  return null
}

