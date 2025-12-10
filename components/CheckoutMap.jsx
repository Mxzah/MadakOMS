import React, { useEffect, useRef } from 'react'
import L from 'leaflet'

const RESTAURANT_ICON_HTML = `
  <div style="
    width:32px;height:32px;border-radius:50%;
    background:#000000;
    display:flex;align-items:center;justify-content:center;
    filter:drop-shadow(0 4px 8px rgba(0,0,0,0.3));
  ">
    <svg fill="#ffffff" width="18" height="18" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" style="display:block;">
      <path d="M22 1.932v11.068h-2v-11c0-.552-.448-1-1-1s-1 .448-1 1v11h-2v-11.036c0-1.287-2-1.243-2-.033v11.069h-2v-10.99c0-1.363-2-1.313-2-.054v14.472c0 2.087 2 3.463 4 3.463v26.109c0 4 6 4 6 0v-26.108c2 0 4-1.662 4-3.227v-14.701c0-1.275-2-1.226-2-.032zm9 3.068v25h2v16c0 4 7 4 7 0v-41c0-5-9-5-9 0z"/>
    </svg>
  </div>
`

const DELIVERY_LOCATION_ICON_HTML = `
  <div style="
    width:32px;height:40px;
    display:flex;align-items:flex-start;justify-content:center;
    filter:drop-shadow(0 4px 8px rgba(0,0,0,0.3));
    pointer-events:none;
  ">
    <svg width="32" height="32" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display:block;">
      <path d="M32,0C18.746,0,8,10.746,8,24c0,5.219,1.711,10.008,4.555,13.93c0.051,0.094,0.059,0.199,0.117,0.289l16,24C29.414,63.332,30.664,64,32,64s2.586-0.668,3.328-1.781l16-24c0.059-0.09,0.066-0.195,0.117-0.289C54.289,34.008,56,29.219,56,24C56,10.746,45.254,0,32,0z M32,32c-4.418,0-8-3.582-8-8s3.582-8,8-8s8,3.582,8,8S36.418,32,32,32z" fill="#ffffff" stroke="#111827" stroke-width="1.5"/>
    </svg>
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

    // Centrer sur une position par défaut (Montréal) pour que la carte s'affiche
    map.setView([45.5, -73.5], 10)

    return () => {
      if (mapInstance.current) {
        try {
          mapInstance.current.remove()
        } catch (e) {
          // Ignorer les erreurs de nettoyage
        }
        mapInstance.current = null
      }
    }
  }, [])

  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    
    if (polygonsLayer.current) {
      try {
        map.removeLayer(polygonsLayer.current)
      } catch (e) {
        // Ignorer les erreurs si la couche n'existe plus
      }
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
      if (firstLatLng) {
        map.setView(firstLatLng, 12)
      }
    }
  }, [polygons])

  // Ajouter le marqueur du restaurant
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    // Supprimer l'ancien marqueur s'il existe
    if (restaurantMarkerRef.current) {
      try {
        map.removeLayer(restaurantMarkerRef.current)
      } catch (e) {
        // Ignorer les erreurs si le marqueur n'existe plus
      }
      restaurantMarkerRef.current = null
    }

    // Ajouter le nouveau marqueur si les coordonnées sont valides
    if (restaurantLocation && 
        typeof restaurantLocation.lat === 'number' && 
        typeof restaurantLocation.lng === 'number' &&
        Number.isFinite(restaurantLocation.lat) &&
        Number.isFinite(restaurantLocation.lng)) {
      try {
        const restaurantIcon = L.divIcon({ html: RESTAURANT_ICON_HTML, className: '', iconSize: [32, 32], iconAnchor: [16, 16] })
        const marker = L.marker([restaurantLocation.lat, restaurantLocation.lng], { icon: restaurantIcon })
        restaurantMarkerRef.current = marker.addTo(map)
      } catch (e) {
        console.error('Error adding restaurant marker:', e)
      }
    }
  }, [restaurantLocation])

  // Ajouter le marqueur de l'adresse de livraison
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    // Supprimer l'ancien marqueur s'il existe
    if (deliveryMarkerRef.current) {
      try {
        map.removeLayer(deliveryMarkerRef.current)
      } catch (e) {
        // Ignorer les erreurs si le marqueur n'existe plus
      }
      deliveryMarkerRef.current = null
    }

    // Ajouter le nouveau marqueur si les coordonnées sont valides
    if (deliveryLocation && 
        typeof deliveryLocation.lat === 'number' && 
        typeof deliveryLocation.lng === 'number' &&
        Number.isFinite(deliveryLocation.lat) &&
        Number.isFinite(deliveryLocation.lng)) {
      try {
        const deliveryIcon = L.divIcon({ 
          html: DELIVERY_LOCATION_ICON_HTML, 
          className: '', 
          iconSize: [32, 40], 
          iconAnchor: [16, 40]
        })
        const marker = L.marker([deliveryLocation.lat, deliveryLocation.lng], { icon: deliveryIcon })
        deliveryMarkerRef.current = marker.addTo(map)
        
        // Ajuster la vue pour inclure le restaurant et l'adresse de livraison si les deux sont présents
        if (restaurantLocation && 
            typeof restaurantLocation.lat === 'number' && 
            typeof restaurantLocation.lng === 'number' &&
            Number.isFinite(restaurantLocation.lat) &&
            Number.isFinite(restaurantLocation.lng)) {
          const restaurantMarker = restaurantMarkerRef.current
          if (restaurantMarker) {
            const group = L.featureGroup([restaurantMarker, marker])
            try {
              map.fitBounds(group.getBounds(), { padding: [20, 20] })
            } catch {
              // Si fitBounds échoue, centrer sur l'adresse de livraison
              map.setView([deliveryLocation.lat, deliveryLocation.lng], 14)
            }
          } else {
            map.setView([deliveryLocation.lat, deliveryLocation.lng], 14)
          }
        } else {
          // Si pas de restaurant, centrer sur l'adresse de livraison
          map.setView([deliveryLocation.lat, deliveryLocation.lng], 14)
        }
      } catch (e) {
        console.error('Error adding delivery marker:', e)
      }
    }
  }, [deliveryLocation, restaurantLocation])

  // Centrer la carte sur le restaurant si pas de polygones ni d'adresse de livraison (mode cueillette)
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    
    // Si pas de polygones, pas d'adresse de livraison, mais un restaurant, centrer sur le restaurant
    if ((!polygons || polygons.length === 0) && 
        !deliveryLocation && 
        restaurantLocation && 
        typeof restaurantLocation.lat === 'number' && 
        typeof restaurantLocation.lng === 'number' &&
        Number.isFinite(restaurantLocation.lat) &&
        Number.isFinite(restaurantLocation.lng)) {
      try {
        map.setView([restaurantLocation.lat, restaurantLocation.lng], 14)
      } catch (e) {
        console.error('Error setting view to restaurant:', e)
      }
    }
  }, [polygons, deliveryLocation, restaurantLocation])

  return <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 12 }} aria-label="Zone de livraison" />
}
