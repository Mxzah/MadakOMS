import React, { useEffect, useRef } from 'react'
import L from 'leaflet'

const RESTAURANT_ICON_HTML = `
  <div style="
    width:28px;height:28px;border-radius:50%;
    background:#dc2626;color:#fff;font-weight:700;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 6px 12px rgba(220,38,38,0.35);
    font-size:16px;
  ">
    🍽️
  </div>
`

const DELIVERY_LOCATION_ICON_HTML = `
  <div style="
    width:28px;height:28px;border-radius:50%;
    background:#22c55e;color:#fff;font-weight:700;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 6px 12px rgba(34,197,94,0.35);
    font-size:16px;
  ">
    📍
  </div>
`

export default function CheckoutMap({ polygons = [], restaurantLocation = null, deliveryLocation = null }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const polygonsLayer = useRef(null)
  const restaurantMarkerRef = useRef(null)
  const deliveryMarkerRef = useRef(null)

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

  // Ajouter le marqueur du restaurant
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    // Supprimer l'ancien marqueur s'il existe
    if (restaurantMarkerRef.current) {
      map.removeLayer(restaurantMarkerRef.current)
      restaurantMarkerRef.current = null
    }

    // Ajouter le nouveau marqueur si les coordonnées sont valides
    if (restaurantLocation && 
        typeof restaurantLocation.lat === 'number' && 
        typeof restaurantLocation.lng === 'number' &&
        Number.isFinite(restaurantLocation.lat) &&
        Number.isFinite(restaurantLocation.lng)) {
      const restaurantIcon = L.divIcon({ html: RESTAURANT_ICON_HTML, className: '', iconSize: [28, 28], iconAnchor: [14, 14] })
      const marker = L.marker([restaurantLocation.lat, restaurantLocation.lng], { icon: restaurantIcon })
      restaurantMarkerRef.current = marker.addTo(map)
    }
  }, [restaurantLocation])

  // Ajouter le marqueur de l'adresse de livraison
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    // Supprimer l'ancien marqueur s'il existe
    if (deliveryMarkerRef.current) {
      map.removeLayer(deliveryMarkerRef.current)
      deliveryMarkerRef.current = null
    }

    // Ajouter le nouveau marqueur si les coordonnées sont valides
    if (deliveryLocation && 
        typeof deliveryLocation.lat === 'number' && 
        typeof deliveryLocation.lng === 'number' &&
        Number.isFinite(deliveryLocation.lat) &&
        Number.isFinite(deliveryLocation.lng)) {
      const deliveryIcon = L.divIcon({ html: DELIVERY_LOCATION_ICON_HTML, className: '', iconSize: [28, 28], iconAnchor: [14, 14] })
      const marker = L.marker([deliveryLocation.lat, deliveryLocation.lng], { icon: deliveryIcon })
      deliveryMarkerRef.current = marker.addTo(map)
      
      // Ajuster la vue pour inclure le restaurant et l'adresse de livraison si les deux sont présents
      if (restaurantLocation && 
          typeof restaurantLocation.lat === 'number' && 
          typeof restaurantLocation.lng === 'number' &&
          Number.isFinite(restaurantLocation.lat) &&
          Number.isFinite(restaurantLocation.lng)) {
        const group = L.featureGroup([
          L.marker([restaurantLocation.lat, restaurantLocation.lng]),
          marker
        ])
        try {
          map.fitBounds(group.getBounds(), { padding: [20, 20] })
        } catch {
          // Si fitBounds échoue, centrer sur l'adresse de livraison
          map.setView([deliveryLocation.lat, deliveryLocation.lng], 14)
        }
      } else {
        // Si pas de restaurant, centrer sur l'adresse de livraison
        map.setView([deliveryLocation.lat, deliveryLocation.lng], 14)
      }
    }
  }, [deliveryLocation, restaurantLocation])

  return <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 12 }} aria-label="Zone de livraison" />
}
