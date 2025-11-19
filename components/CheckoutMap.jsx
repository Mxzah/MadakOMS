import React from 'react'

// Google My Maps embed
// Source map: https://www.google.com/maps/d/u/0/viewer?mid=10Hhv0BNvi-bKSUmOVY5dEuRNf3E&femb=1&ll=46.56592724004334%2C-72.75049925&z=13
// Embed URL format
const EMBED_URL = 'https://www.google.com/maps/d/embed?mid=10Hhv0BNvi-bKSUmOVY5dEuRNf3E&ll=46.56592724004334,-72.75049925&z=13'

export default function CheckoutMap() {
  return (
    <iframe
      title="Zone de livraison"
      src={EMBED_URL}
      style={{ border: 0, width: '100%', height: '100%', borderRadius: 12 }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  )
}
