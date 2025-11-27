import React, { useEffect, useRef } from 'react'
import L from 'leaflet'

const DRIVER_ICON_HTML = `
  <div style="
    width:26px;height:26px;border-radius:50%;
    background:#0f172a;color:#fff;font-weight:700;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 6px 12px rgba(15,23,42,0.35);
  ">
    🚚
  </div>
`

const DESTINATION_ICON_HTML = `
  <div style="
    width:22px;height:22px;border-radius:50%;
    background:#22c55e;color:#fff;font-weight:700;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 6px 12px rgba(34,197,94,0.35);
  ">
    📍
  </div>
`

export default function DriverMap({ driverPosition, destinationPosition }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const driverMarkerRef = useRef(null)
  const destinationMarkerRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    const map = L.map(mapRef.current, { zoomControl: true })
    mapInstanceRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    const hasDriver = driverPosition && isFinite(driverPosition.lat) && isFinite(driverPosition.lng)
    const hasDestination =
      destinationPosition && isFinite(destinationPosition.lat) && isFinite(destinationPosition.lng)

    if (driverMarkerRef.current) {
      map.removeLayer(driverMarkerRef.current)
      driverMarkerRef.current = null
    }
    if (destinationMarkerRef.current) {
      map.removeLayer(destinationMarkerRef.current)
      destinationMarkerRef.current = null
    }

    if (hasDriver) {
      const driverIcon = L.divIcon({ html: DRIVER_ICON_HTML, className: '' })
      driverMarkerRef.current = L.marker([driverPosition.lat, driverPosition.lng], { icon: driverIcon }).addTo(map)
    }

    if (hasDestination) {
      const destinationIcon = L.divIcon({ html: DESTINATION_ICON_HTML, className: '' })
      destinationMarkerRef.current = L.marker([destinationPosition.lat, destinationPosition.lng], {
        icon: destinationIcon,
      }).addTo(map)
    }

    const points = []
    if (hasDriver) points.push([driverPosition.lat, driverPosition.lng])
    if (hasDestination) points.push([destinationPosition.lat, destinationPosition.lng])

    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 14)
      return
    }
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [24, 24] })
  }, [driverPosition?.lat, driverPosition?.lng, destinationPosition?.lat, destinationPosition?.lng])

  return <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 16 }} aria-label="Carte du livreur" />
}

