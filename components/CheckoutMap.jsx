import React, { useEffect, useRef } from 'react'
import L from 'leaflet'

export default function CheckoutMap({ polygons = [] }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const polygonsLayer = useRef(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = L.map(mapRef.current, { zoomControl: true })
    mapInstance.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    return () => {
      map.remove()
      mapInstance.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    if (polygonsLayer.current) {
      map.removeLayer(polygonsLayer.current)
      polygonsLayer.current = null
    }
    if (!Array.isArray(polygons) || polygons.length === 0) return

    const layers = polygons
      .filter((poly) => Array.isArray(poly) && poly.length >= 3)
      .map((poly) => L.polygon(poly, { color: '#2563eb', weight: 2, fillOpacity: 0.08 }))

    if (layers.length === 0) return

    const group = L.featureGroup(layers)
    polygonsLayer.current = group.addTo(map)
    try {
      map.fitBounds(group.getBounds(), { padding: [12, 12] })
    } catch {
      const latLngs = layers[0]?.getLatLngs?.()
      const firstLatLng = Array.isArray(latLngs) ? latLngs[0]?.[0] : null
      if (firstLatLng) map.setView(firstLatLng, 12)
    }
  }, [polygons])

  return <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 12 }} aria-label="Zone de livraison" />
}
