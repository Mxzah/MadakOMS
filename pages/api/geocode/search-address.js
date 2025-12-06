export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { q } = req.query

  if (!q || typeof q !== 'string' || q.trim().length < 3) {
    return res.status(400).json({ error: 'Query must be at least 3 characters' })
  }

  const query = q.trim()

  // Try Photon first, then fallback to Nominatim
  try {
    // Try Photon API
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lang=fr&limit=8`
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const photonResponse = await fetch(photonUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MadakOMS/1.0',
      },
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)

    if (photonResponse.ok) {
      const json = await photonResponse.json()

      // Transform the response to match the expected format
      const items = (json.features || []).map(f => {
        const [lng, lat] = f.geometry.coordinates
        const p = f.properties || {}
        const parts = [p.name, p.housenumber, p.street].filter(Boolean)
        const city = [p.city || p.town || p.village, p.state].filter(Boolean).join(', ')
        const country = p.country
        const label = [parts.join(' '), city, country].filter(Boolean).join(', ')
        return { label, lat, lng }
      })

      return res.status(200).json({ results: items })
    }
  } catch (photonError) {
    console.warn('[Geocode API] Photon failed, trying Nominatim:', photonError.message)
  }

  // Fallback to Nominatim (OpenStreetMap)
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=8&accept-language=fr`
    
    const controller2 = new AbortController()
    const timeoutId2 = setTimeout(() => controller2.abort(), 5000)
    
    const nominatimResponse = await fetch(nominatimUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MadakOMS/1.0',
        'Referer': req.headers.referer || 'https://madakoms.com',
      },
      signal: controller2.signal,
    })
    
    clearTimeout(timeoutId2)

    if (!nominatimResponse.ok) {
      throw new Error(`Nominatim API error: ${nominatimResponse.status} ${nominatimResponse.statusText}`)
    }

    const json = await nominatimResponse.json()

    // Transform Nominatim response to match the expected format
    const items = (json || []).map(item => {
      const lat = parseFloat(item.lat)
      const lng = parseFloat(item.lon)
      const addr = item.address || {}
      
      // Build address label
      const parts = []
      if (addr.house_number) parts.push(addr.house_number)
      if (addr.road) parts.push(addr.road)
      if (addr.house) parts.push(addr.house)
      
      const cityParts = []
      if (addr.city || addr.town || addr.village) {
        cityParts.push(addr.city || addr.town || addr.village)
      }
      if (addr.state) {
        cityParts.push(addr.state)
      }
      
      const label = [
        parts.join(' '),
        cityParts.join(', '),
        addr.country
      ].filter(Boolean).join(', ') || item.display_name

      return { label, lat, lng }
    })

    return res.status(200).json({ results: items })
  } catch (error) {
    console.error('[Geocode API] Both APIs failed:', error.message)
    return res.status(500).json({ 
      error: 'Failed to search addresses', 
      message: 'Les services de géocodage sont temporairement indisponibles. Veuillez réessayer plus tard.' 
    })
  }
}

