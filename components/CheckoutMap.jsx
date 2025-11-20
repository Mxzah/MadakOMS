import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import { deliveryPolygon } from '../data/deliveryArea'

export default function CheckoutMap() {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = L.map(mapRef.current, { zoomControl: true })
    mapInstance.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    const poly = L.polygon(deliveryPolygon, { color: '#2563eb', weight: 2, fillOpacity: 0.08 })
    poly.addTo(map)
    try {
      map.fitBounds(poly.getBounds(), { padding: [12, 12] })
    } catch {
      map.setView(deliveryPolygon[0] || [0, 0], 12)
    }

    return () => {
      map.remove()
      mapInstance.current = null
    }
  }, [])

  return <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 12 }} aria-label="Zone de livraison" />
}
