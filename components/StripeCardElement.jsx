import { useEffect, useRef, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'

// Charger Stripe avec la clé publique (mode sandbox)
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

const elementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#9e2146',
    },
  },
}

function CheckoutForm({ onCardReady, onError, disabled }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState(null)
  const [postalCode, setPostalCode] = useState('')
  const [postalCodeError, setPostalCodeError] = useState('')
  const cardCompleteRef = useRef({
    number: false,
    expiry: false,
    cvc: false,
  })

  useEffect(() => {
    if (!stripe || !elements) {
      return
    }

    const cardNumber = elements.getElement(CardNumberElement)
    const cardExpiry = elements.getElement(CardExpiryElement)
    const cardCvc = elements.getElement(CardCvcElement)

    if (!cardNumber || !cardExpiry || !cardCvc) return

    const checkAndNotify = () => {
      const complete = cardCompleteRef.current
      // Valider le code postal canadien (format: A1A 1A1 ou A1A1A1)
      const postalCodeValid = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(postalCode.replace(/\s+/g, ''))
      if (complete.number && complete.expiry && complete.cvc && postalCodeValid) {
        const cardData = {
          cardNumber,
          cardExpiry,
          cardCvc,
          postalCode: postalCode.replace(/\s+/g, '').toUpperCase(),
          stripeInstance: stripe, // Passer l'instance Stripe
        }
        onCardReady?.(cardData)
      }
    }

    const handleNumberChange = (event) => {
      if (event.error) {
        setError(event.error.message)
        onError?.(event.error.message)
      } else {
        setError(null)
        onError?.(null)
        cardCompleteRef.current.number = event.complete
        checkAndNotify()
      }
    }

    const handleExpiryChange = (event) => {
      if (event.error) {
        setError(event.error.message)
        onError?.(event.error.message)
      } else {
        setError(null)
        onError?.(null)
        cardCompleteRef.current.expiry = event.complete
        checkAndNotify()
      }
    }

    const handleCvcChange = (event) => {
      if (event.error) {
        setError(event.error.message)
        onError?.(event.error.message)
      } else {
        setError(null)
        onError?.(null)
        cardCompleteRef.current.cvc = event.complete
        checkAndNotify()
      }
    }

    cardNumber.on('change', handleNumberChange)
    cardExpiry.on('change', handleExpiryChange)
    cardCvc.on('change', handleCvcChange)

    return () => {
      cardNumber.off('change', handleNumberChange)
      cardExpiry.off('change', handleExpiryChange)
      cardCvc.off('change', handleCvcChange)
    }
  }, [stripe, elements, onCardReady, onError, postalCode])

  const handlePostalCodeChange = (e) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9\s-]/g, '')
    // Limiter à 7 caractères (A1A 1A1)
    if (value.replace(/\s+/g, '').length > 6) {
      value = value.slice(0, 7)
    }
    setPostalCode(value)
    setPostalCodeError('')
    
    // Valider le format canadien
    const cleaned = value.replace(/\s+/g, '')
    if (cleaned.length > 0 && !/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
      if (cleaned.length >= 3) {
        setPostalCodeError('Format invalide. Utilisez: A1A 1A1')
      }
    } else if (cleaned.length === 6) {
      setPostalCodeError('')
      // Vérifier si tous les champs sont complets
      const complete = cardCompleteRef.current
      if (complete.number && complete.expiry && complete.cvc) {
        const cardNumber = elements?.getElement(CardNumberElement)
        const cardExpiry = elements?.getElement(CardExpiryElement)
        const cardCvc = elements?.getElement(CardCvcElement)
        if (cardNumber && cardExpiry && cardCvc && stripe) {
          const cardData = {
            cardNumber,
            cardExpiry,
            cardCvc,
            postalCode: cleaned,
            stripeInstance: stripe, // Passer l'instance Stripe
          }
          onCardReady?.(cardData)
        }
      }
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
          Numéro de carte
        </label>
        <div style={{ padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px' }}>
          <CardNumberElement options={elementOptions} />
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
            Date d'expiration
          </label>
          <div style={{ padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px' }}>
            <CardExpiryElement options={elementOptions} />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
            CVC
          </label>
          <div style={{ padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px' }}>
            <CardCvcElement options={elementOptions} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
          Code postal
        </label>
        <input
          type="text"
          value={postalCode}
          onChange={handlePostalCodeChange}
          placeholder="G9P 4G2"
          maxLength={7}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px',
            border: postalCodeError ? '1px solid #dc2626' : '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '16px',
          }}
        />
        {postalCodeError && (
          <div style={{ color: '#dc2626', fontSize: '14px', marginTop: '4px' }}>
            {postalCodeError}
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: '#dc2626', fontSize: '14px', marginTop: '4px' }}>
          {error}
        </div>
      )}
    </div>
  )
}

export default function StripeCardElement({ clientSecret, onCardReady, onError, disabled }) {
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <div style={{ color: '#dc2626', fontSize: '14px', padding: '12px' }}>
        Stripe n'est pas configuré. Veuillez définir NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY dans les variables d'environnement.
      </div>
    )
  }

  if (!clientSecret) {
    return (
      <div style={{ color: '#6b7280', fontSize: '14px', padding: '12px', textAlign: 'center' }}>
        Chargement du formulaire de paiement...
      </div>
    )
  }

  const elementsOptions = clientSecret ? { clientSecret } : {}

  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      <CheckoutForm onCardReady={onCardReady} onError={onError} disabled={disabled} />
    </Elements>
  )
}

