import React, { useEffect, useRef } from 'react'
import L from 'leaflet'

const DRIVER_ICON_HTML = `
  <div style="
    width:26px;height:26px;border-radius:50%;
    background:#0f172a;color:#fff;font-weight:700;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 6px 12px rgba(15,23,42,0.35);
  ">
    <svg height="18px" width="18px" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve" style="display:block;">
      <style type="text/css">
        .st0{fill:#ffffff;}
      </style>
      <g>
        <path class="st0" d="M144.22,323.83c-28.184,0-51.02,22.836-51.02,51.02s22.836,51.02,51.02,51.02s51.02-22.836,51.02-51.02
          S172.404,323.83,144.22,323.83z M144.22,397.808c-12.683,0-22.958-10.275-22.958-22.958s10.275-22.958,22.958-22.958
          s22.958,10.275,22.958,22.958S156.902,397.808,144.22,397.808z"/>
        <path class="st0" d="M397.084,323.83c-28.184,0-51.021,22.836-51.021,51.02s22.837,51.02,51.021,51.02
          c28.184,0,51.02-22.836,51.02-51.02S425.267,323.83,397.084,323.83z M397.084,397.808c-12.683,0-22.958-10.275-22.958-22.958
          s10.275-22.958,22.958-22.958c12.682,0,22.958,10.275,22.958,22.958S409.766,397.808,397.084,397.808z"/>
        <path class="st0" d="M509.278,107.211c-2.633-6.216-6.981-11.467-12.497-15.179c-2.746-1.86-5.789-3.342-9.043-4.357
          c-3.244-1.006-6.707-1.546-10.258-1.546H166.42c-4.397,0-8.737,0.693-12.844,2.126c-3.076,1.064-6.015,2.545-8.737,4.413
          c-4.082,2.778-7.61,6.41-10.412,10.678c-2.698,4.09-4.711,8.729-6.056,13.786L97.87,200.933l-0.137,0.572
          c-0.386,1.514-0.878,2.81-1.458,3.978c-0.886,1.724-1.972,3.197-3.326,4.582c-1.353,1.377-2.987,2.666-4.888,3.881l-72.118,46.076
          C6.014,266.36,0,277.335,0,289.108v49.998c0,4.735,0.966,9.308,2.714,13.448c2.641,6.208,7.006,11.458,12.506,15.179
          c2.746,1.86,5.789,3.325,9.042,4.34c3.245,1.014,19.511,2.754,23.071,2.754h28.86c0.016-37.565,30.462-68.003,68.027-68.003
          c37.564,0,68.011,30.438,68.028,68.003h116.809c0.017-37.565,30.462-68.003,68.028-68.003c37.565,0,68.011,30.438,68.027,68.003
          h7.408c0-0.274-0.007-0.548-0.016-0.822h0.016l-0.016-0.008c0-0.121-0.008-0.242-0.008-0.363h4.984
          c4.735,0,9.309-0.974,13.44-2.722c6.217-2.641,11.458-6.989,15.179-12.498c1.868-2.754,3.342-5.789,4.348-9.043
          c1.015-3.245,1.554-6.716,1.554-10.267V120.642C512,115.908,511.026,111.342,509.278,107.211z M166.887,248.064
          c0-4.268,3.462-7.73,7.73-7.73h34.014c4.268,0,7.73,3.462,7.73,7.73c0,4.268-3.462,7.73-7.73,7.73h-34.014
          C170.35,255.795,166.887,252.332,166.887,248.064z M132.584,211.128c-2.191-3.133-2.714-7.126-1.402-10.71l27.692-75.862
          l0.282-1.071c0.669-2.528,1.61-4.726,2.803-6.522c1.063-1.618,2.295-2.899,3.672-3.841c0.966-0.669,1.916-1.144,2.898-1.482
          c1.49-0.524,3.068-0.774,4.768-0.774h32.419c6.45,0,11.684,5.234,11.684,11.684v81.878c0,6.45-5.235,11.684-11.684,11.684h-63.558
          C138.341,216.112,134.766,214.252,132.584,211.128z M260.344,204.428V122.55c0-6.45,5.234-11.684,11.684-11.684h110.625
          c6.45,0,11.684,5.234,11.684,11.684v81.878c0,6.45-5.234,11.684-11.684,11.684H272.029
          C265.579,216.112,260.344,210.878,260.344,204.428z"/>
      </g>
    </svg>
  </div>
`

const DESTINATION_ICON_HTML = `
  <div style="
    width:22px;height:22px;border-radius:50%;
    background:#000000;color:#fff;font-weight:700;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 6px 12px rgba(0,0,0,0.35);
  ">
    <svg height="16px" width="16px" version="1.0" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64" enable-background="new 0 0 64 64" xml:space="preserve" style="display:block;">
      <path fill="#ffffff" d="M32,0C18.746,0,8,10.746,8,24c0,5.219,1.711,10.008,4.555,13.93c0.051,0.094,0.059,0.199,0.117,0.289l16,24
        C29.414,63.332,30.664,64,32,64s2.586-0.668,3.328-1.781l16-24c0.059-0.09,0.066-0.195,0.117-0.289C54.289,34.008,56,29.219,56,24
        C56,10.746,45.254,0,32,0z M32,32c-4.418,0-8-3.582-8-8s3.582-8,8-8s8,3.582,8,8S36.418,32,32,32z"/>
    </svg>
  </div>
`

const RESTAURANT_ICON_HTML = `
  <div style="
    width:24px;height:24px;border-radius:50%;
    background:#000000;color:#fff;font-weight:700;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 6px 12px rgba(0,0,0,0.35);
  ">
    <svg fill="#ffffff" width="12px" height="12px" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" style="display:block;">
      <path d="M22 1.932v11.068h-2v-11c0-.552-.448-1-1-1s-1 .448-1 1v11h-2v-11.036c0-1.287-2-1.243-2-.033v11.069h-2v-10.99c0-1.363-2-1.313-2-.054v14.472c0 2.087 2 3.463 4 3.463v26.109c0 4 6 4 6 0v-26.108c2 0 4-1.662 4-3.227v-14.701c0-1.275-2-1.226-2-.032zm9 3.068v25h2v16c0 4 7 4 7 0v-41c0-5-9-5-9 0z"/>
    </svg>
  </div>
`

export default function DriverMap({ driverPosition, destinationPosition, restaurantPosition }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const driverMarkerRef = useRef(null)
  const destinationMarkerRef = useRef(null)
  const restaurantMarkerRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    const map = L.map(mapRef.current, { zoomControl: true })
    mapInstanceRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    // Attendre que la carte soit prête avant de faire des opérations
    map.whenReady(() => {
      // La carte est maintenant prête
    })

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
    const hasRestaurant =
      restaurantPosition && isFinite(restaurantPosition.lat) && isFinite(restaurantPosition.lng)

    if (driverMarkerRef.current) {
      map.removeLayer(driverMarkerRef.current)
      driverMarkerRef.current = null
    }
    if (destinationMarkerRef.current) {
      map.removeLayer(destinationMarkerRef.current)
      destinationMarkerRef.current = null
    }
    if (restaurantMarkerRef.current) {
      map.removeLayer(restaurantMarkerRef.current)
      restaurantMarkerRef.current = null
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

    if (hasRestaurant) {
      const restaurantIcon = L.divIcon({ html: RESTAURANT_ICON_HTML, className: '' })
      restaurantMarkerRef.current = L.marker([restaurantPosition.lat, restaurantPosition.lng], {
        icon: restaurantIcon,
      }).addTo(map)
    }

    const points = []
    if (hasDriver) points.push([driverPosition.lat, driverPosition.lng])
    if (hasDestination) points.push([destinationPosition.lat, destinationPosition.lng])
    if (hasRestaurant) points.push([restaurantPosition.lat, restaurantPosition.lng])

    if (points.length === 0) return

    // S'assurer que la carte a une taille valide avant de faire des opérations
    map.invalidateSize()
    
    // Utiliser setTimeout pour s'assurer que la carte est complètement prête
    setTimeout(() => {
      try {
        if (!map || !map.getContainer()) return
        
        if (points.length === 1) {
          map.setView(points[0], 14)
        } else {
          const bounds = L.latLngBounds(points)
          map.fitBounds(bounds, { padding: [24, 24] })
        }
      } catch (error) {
        // Ignorer les erreurs si la carte n'est pas encore complètement prête
        console.warn('Erreur lors de la mise à jour de la carte:', error)
      }
    }, 100)
  }, [driverPosition?.lat, driverPosition?.lng, destinationPosition?.lat, destinationPosition?.lng, restaurantPosition?.lat, restaurantPosition?.lng])

  return <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 16 }} aria-label="Carte du livreur" />
}

