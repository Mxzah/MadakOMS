import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import Header from '../../components/Header'
import styles from '../../styles/OrderTrackPage.module.css'
import { supabaseClient } from '../../lib/supabase/client'
import { formatPrice } from '../../lib/currency'

const DriverMap = dynamic(() => import('../../components/DriverMap'), { ssr: false })

const DELIVERY_FLOW = ['received', 'preparing', 'ready', 'enroute', 'completed']
const PICKUP_FLOW = ['preparing', 'ready', 'retrieved']

function statusLabel(status, fulfillment) {
  switch (status) {
    case 'received':
      return 'Reçue'
    case 'preparing':
      return 'En préparation'
    case 'ready':
      return 'Prête'
    case 'assigned':
      return 'Prête'
    case 'enroute':
      return 'En route'
    case 'completed':
      return fulfillment === 'pickup' ? 'Récupéré' : 'Livrée'
    case 'retrieved':
      return 'Récupéré'
    case 'failed':
      return 'Échec'
    case 'cancelled':
      return 'Annulée'
    default:
      return '—'
  }
}

export default function OrderTrackPage() {
  const router = useRouter()
  const { id } = router.query
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const lastStatusRef = useRef(null)

  const loadOrder = useCallback(
    async ({ signal, silent = false } = {}) => {
      if (!id) return
      if (!silent) {
        setLoading(true)
        setError('')
      }
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, { signal })
        const payload = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(payload?.error || 'Impossible de charger la commande.')
        }
        setOrder(payload)
      } catch (err) {
        if (err.name === 'AbortError') return
        if (!silent) {
          setError(err.message || 'Impossible de charger la commande.')
          setOrder(null)
        }
      } finally {
        if (!silent && (!signal || !signal.aborted)) {
          setLoading(false)
        }
      }
    },
    [id]
  )

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    loadOrder({ signal: controller.signal })
    const interval = setInterval(() => {
      loadOrder({ silent: true })
    }, 60000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [id, loadOrder])

  useEffect(() => {
    if (!id) return undefined
    const channel = supabaseClient
      .channel(`order-tracking-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, (payload) => {
        if (!payload?.new) return
        setOrder((prev) => (prev ? { ...prev, ...mapOrderPatch(payload.new) } : prev))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_events', filter: `order_id=eq.${id}` }, (payload) => {
        if (!payload?.new) return
        setOrder((prev) => (prev ? { ...prev, events: [...(prev.events || []), payload.new] } : prev))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments', filter: `order_id=eq.${id}` }, (payload) => {
        if (!payload?.new) return
        setOrder((prev) => (prev ? { ...prev, payments: [...(prev.payments || []), payload.new] } : prev))
      })
      .subscribe()

    return () => {
      supabaseClient.removeChannel(channel)
    }
  }, [id])

  useEffect(() => {
    if (!order?.driver_id) return undefined
    const channel = supabaseClient
      .channel(`driver-locations-${order.driver_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations', filter: `staff_id=eq.${order.driver_id}` },
        (payload) => {
          if (!payload?.new) return
          const location = normalizeDriverLocation(payload.new)
          if (!location) return
          setOrder((prev) => (prev ? { ...prev, driverLocation: location } : prev))
        }
      )
      .subscribe()

    return () => {
      supabaseClient.removeChannel(channel)
    }
  }, [order?.driver_id])

  // Vérifier la proximité du livreur périodiquement quand la commande est en route
  useEffect(() => {
    if (!id || !order || order.status !== 'enroute' || order.fulfillment !== 'delivery') {
      return undefined
    }

    // Vérifier la proximité toutes les 30 secondes
    const checkProximity = async () => {
      try {
        await fetch(`/api/orders/${id}/check-driver-proximity`, {
          method: 'POST',
        })
      } catch (error) {
        // Ignorer les erreurs silencieusement pour ne pas perturber l'expérience utilisateur
        console.error('[Order Tracking] Erreur lors de la vérification de proximité:', error)
      }
    }

    // Vérifier immédiatement, puis toutes les 30 secondes
    checkProximity()
    const interval = setInterval(checkProximity, 30000) // 30 secondes

    return () => {
      clearInterval(interval)
    }
  }, [id, order?.status, order?.fulfillment])

  const normalizedStatus = normalizeStatus(order?.status)

  const isFailed = normalizedStatus === 'failed'
  const steps = useMemo(() => {
    const base = order?.fulfillment === 'pickup' ? PICKUP_FLOW : DELIVERY_FLOW
    if (order?.status === 'cancelled' && !base.includes('cancelled')) {
      return [...base, 'cancelled']
    }
    return base
  }, [order?.fulfillment, order?.status])

  const timelineStatus = useMemo(() => {
    if (isFailed) return 'enroute'
    // En mode pickup, mapper les statuts pour la timeline
    if (order?.fulfillment === 'pickup') {
      if (normalizedStatus === 'completed') {
        return 'retrieved'
      }
      // Si le statut est 'received' en mode pickup, on le mappe à 'preparing' car 'received' n'est pas dans le flow
      if (normalizedStatus === 'received') {
        return 'preparing'
      }
    }
    return normalizedStatus
  }, [isFailed, normalizedStatus, order?.fulfillment])

  const currentIdx = useMemo(() => {
    if (!timelineStatus) return 0
    const idx = steps.indexOf(timelineStatus)
    return idx === -1 ? 0 : idx
  }, [steps, timelineStatus])
  const orderNumber = order?.order_number || order?.orderNumber || null
  const orderNumberLabel = orderNumber ? `#${orderNumber}` : null
  const serviceLabel = order?.fulfillment === 'pickup' ? 'Cueillette' : 'Livraison'
  const paymentLabel = useMemo(() => formatPaymentLabel(order?.payments, order?.fulfillment), [order?.payments, order?.fulfillment])
  const deliveryLine = useMemo(() => {
    if (!order) return '—'
    if (order.fulfillment === 'pickup') return 'Cueillette au comptoir'
    return formatAddress(order.delivery_address)
  }, [order])
  const scheduledLabel = useMemo(() => {
    if (!order) return null
    if (order.fulfillment === 'pickup') return null
    if (!order.scheduled_at) return null
    return formatDateTime(order.scheduled_at)
  }, [order])

  const driverUpdatedLabel = useMemo(() => {
    if (!order?.driverLocation?.updated_at) return null
    const date = new Date(order.driverLocation.updated_at)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })
  }, [order?.driverLocation?.updated_at])

  const driverPosition = useMemo(() => {
    if (!order?.driverLocation) return null
    const lat = Number(order.driverLocation.lat)
    const lng = Number(order.driverLocation.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  }, [order?.driverLocation])

  const restaurantPosition = useMemo(() => {
    const lat = Number(order?.restaurantLocation?.lat)
    const lng = Number(order?.restaurantLocation?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  }, [order?.restaurantLocation])

  const destinationPosition = useMemo(() => {
    const lat = Number(order?.delivery_address?.lat)
    const lng = Number(order?.delivery_address?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  }, [order?.delivery_address])

  const [etaLabel, setEtaLabel] = useState('Non disponible')

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    let intervalId
    const updateEta = () => {
      const seconds = computeDriverEtaSeconds({
        status: order?.status,
        driverPosition,
        restaurantPosition,
        destinationPosition,
      })
      if (!seconds) {
        if (order?.scheduled_at) {
          const date = new Date(order.scheduled_at)
          if (!Number.isNaN(date.getTime())) {
            setEtaLabel(date.toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' }))
            return
          }
        }
        setEtaLabel('Non disponible')
        return
      }
      const etaDate = new Date(Date.now() + seconds * 1000)
      setEtaLabel(etaDate.toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' }))
    }

    updateEta()
    intervalId = window.setInterval(updateEta, 60000)
    return () => {
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [order?.status, order?.scheduled_at, driverPosition, restaurantPosition, destinationPosition])

  useEffect(() => {
    if (!normalizedStatus) return
    if (lastStatusRef.current && lastStatusRef.current !== normalizedStatus) {
      const statusForEvent = normalizedStatus
      setOrder((prev) => {
        if (!prev) return prev
        const events = prev.events || []
        const alreadyLogged = events.some(
          (event) => event.event_type === 'status_changed' && event.payload?.status === statusForEvent
        )
        if (alreadyLogged) return prev
        const nextEvents = [...events, buildLocalStatusEvent(statusForEvent)]
        return { ...prev, events: nextEvents }
      })
    }
    lastStatusRef.current = normalizedStatus
  }, [normalizedStatus])

  return (
    <div>
      <Header name="Détails de la commande" showCart={false} />
      <main className={styles.wrapper}>
        <section className={styles.left}>
          <h2 className={styles.title}>Commande {orderNumberLabel || id || ''}</h2>
          {order?.restaurant?.name && <p className={styles.subtitle}>{order.restaurant.name}</p>}
          {order && (
            <div className={`${styles.statusBadge} ${order.status === 'cancelled' || order.status === 'failed' ? styles.statusBadgeDanger : ''}`}>
              {statusLabel(normalizedStatus, order.fulfillment)}
            </div>
          )}
          {loading && <div className={styles.alert} role="status">Chargement en cours…</div>}
          {error && <div className={styles.alert} role="alert">{error}</div>}
          {!loading && !order && !error && <div className={styles.alert}>Commande introuvable.</div>}

          {order && (
            <>
              <div className={styles.timeline}>
                {steps.map((step, index) => {
                  const done = index <= currentIdx
                  const isCancelled = step === 'cancelled'
                  const stepClasses = [styles.step]
                  if (done) stepClasses.push(styles.stepDone)
                  if (isCancelled) stepClasses.push(styles.stepCancelled)
                  return (
                    <React.Fragment key={step}>
                      <div className={stepClasses.join(' ')}>
                        <div className={styles.dot} />
                        <div className={styles.label}>{statusLabel(step, order.fulfillment)}</div>
                      </div>
                      {index < steps.length - 1 && (
                        <div
                          className={[
                            styles.connector,
                            index < currentIdx ? styles.connectorDone : '',
                            steps[index + 1] === 'cancelled' ? styles.connectorCancelled : '',
                            isFailed && step === 'enroute' && steps[index + 1] === 'completed' ? styles.connectorFailed : '',
                          ].join(' ').trim()}
                          aria-hidden
                        />
                      )}
                    </React.Fragment>
                  )
                })}
              </div>

              {order?.driver_id && order?.fulfillment === 'delivery' && !['cancelled', 'failed', 'completed'].includes(order.status) && (
                <div className={styles.driverSection}>
                  <div className={styles.driverSectionHeader}>
                    <div>
                      <div className={styles.driverSectionTitle}>Position du livreur</div>
                      {driverUpdatedLabel && (
                        <div className={styles.driverSectionSubtitle}>
                          Mise à jour {driverUpdatedLabel} · Heure d&apos;arrivée prévue : {etaLabel}
                        </div>
                      )}
                    </div>
                    {!driverPosition && (
                      <span className={styles.driverSectionHelper}>Localisation en cours…</span>
                    )}
                  </div>
                  <div className={styles.driverMapWrapper}>
                    {driverPosition ? (
                      <DriverMap driverPosition={driverPosition} destinationPosition={destinationPosition} />
                    ) : (
                      <div className={styles.driverMapEmpty}>Le livreur n'a pas encore partagé sa position.</div>
                    )}
                  </div>
                </div>
              )}

              {isFailed && (
                <div className={styles.failedMessage} role="alert">
                Message de notre équipe : {getFailedMessage(order) || "La commande a été marquée comme échouée."}
                </div>
              )}

              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span>Numéro</span>
                  <strong>{orderNumberLabel || (orderNumber ? orderNumber : '—')}</strong>
                </div>
                <div className={styles.metaItem}>
                  <span>Commandée le</span>
                  <strong>{formatDateTime(order.placed_at)}</strong>
                </div>
                {scheduledLabel && (
                  <div className={styles.metaItem}>
                    <span>Fenêtre prévue</span>
                    <strong>{scheduledLabel}</strong>
                  </div>
                )}
                {deliveryLine && deliveryLine !== '—' && (
                  <div className={styles.metaItem}>
                    <span>Adresse / retrait</span>
                    <strong>{deliveryLine}</strong>
                  </div>
                )}
                {order.delivery_address?.instructions && (
                  <div className={styles.metaItem}>
                    <span>Instructions</span>
                    <strong>{order.delivery_address.instructions}</strong>
                  </div>
                )}
              </div>

              <div className={styles.eventsSection}>
                <div className={styles.eventsTitle}>Activité récente</div>
                {(() => {
                  // Filtrer les événements status_changed qui n'ont pas de payload.status valide
                  // (ceux qui affichent juste "status changed" sans information utile)
                  const filteredEvents = (order.events || []).filter((event) => {
                    if (event.event_type === 'status_changed') {
                      // Garder seulement ceux qui ont un payload.status valide
                      return event.payload?.status && typeof event.payload.status === 'string'
                    }
                    // Garder tous les autres types d'événements
                    return true
                  })
                  
                  if (filteredEvents.length === 0) {
                    return <div className={styles.emptyState}>Aucune mise à jour pour le moment.</div>
                  }
                  
                  return (
                    <div className={styles.eventsList}>
                      {filteredEvents.map((event) => (
                        <div key={event.id} className={styles.eventRow}>
                          <div className={styles.eventTime}>{formatDateTime(event.created_at, { dateStyle: 'short', timeStyle: 'short' })}</div>
                          <div className={styles.eventTitle}>{formatEventTitle(event, order.fulfillment)}</div>
                          {formatEventDescription(event) && (
                            <div className={styles.eventDesc}>{formatEventDescription(event)}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </>
          )}
        </section>

        <aside className={styles.right}>
          {!order && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Détails</div>
              <div className={styles.emptyState}>Les informations apparaîtront dès que la commande sera chargée.</div>
            </div>
          )}

          {order && (
            <>
              <div className={styles.card}>
                <div className={styles.cardTitle}>Détails</div>
                <div className={styles.row}><span>Service</span><strong>{serviceLabel}</strong></div>
                <div className={styles.row}><span>Paiement</span><strong>{paymentLabel}</strong></div>
                {(order.pickup_name || order.delivery_name || order.delivery_address?.address) && (
                  <div className={styles.row}><span>Client</span><strong>{order.pickup_name || order.delivery_name || order.delivery_address?.address}</strong></div>
                )}
                {(order.pickup_phone || order.customer?.phone) && (
                  <div className={styles.row}><span>Téléphone</span><strong>{order.pickup_phone || order.customer?.phone}</strong></div>
                )}
                <div className={styles.row}><span>Total</span><strong>{formatPrice(order.total)}</strong></div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardTitle}>Articles</div>
                {(order.items || []).map((item) => (
                  <div className={styles.itemRow} key={item.id}>
                    <div className={styles.itemName}>{item.name}</div>
                    <div className={styles.itemMeta}>Qté&nbsp;: {item.quantity}</div>
                    <div className={styles.itemPrice}>{formatPrice(item.total_price)}</div>
                    {item.modifiers?.length > 0 && (
                      <div className={styles.modifierList}>
                        {item.modifiers.map((mod) => (
                          <div key={`${item.id}-${mod.option_name}`} className={styles.modifierLine}>
                            <span>{mod.modifier_name}</span>
                            <strong>{mod.option_name}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className={styles.card}>
                <div className={styles.cardTitle}>Résumé</div>
                <div className={styles.row}><span>Sous-total</span><strong>{formatPrice(order.subtotal)}</strong></div>
                <div className={styles.row}><span>Frais de livraison</span><strong>{formatPrice(order.delivery_fee)}</strong></div>
                <div className={styles.row}><span>Taxes</span><strong>{formatPrice(order.taxes)}</strong></div>
                {Number(order.tip_amount || 0) > 0 && (
                  <div className={styles.row}><span>Pourboire</span><strong>{formatPrice(order.tip_amount)}</strong></div>
                )}
                <div className={styles.row}><span>Total</span><strong>{formatPrice(order.total)}</strong></div>
              </div>
            </>
          )}
        </aside>
      </main>
    </div>
  )
}

function formatDateTime(value, options = {}) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-CA', {
    dateStyle: options.dateStyle || 'medium',
    timeStyle: options.timeStyle || 'short',
    hour12: false,
  })
}

function formatAddress(address) {
  if (!address) return '—'
  const parts = [address.address, address.apartmentSuite, address.city, address.postalCode]
  return parts.filter((part) => part && String(part).trim().length > 0).join(', ') || '—'
}

function formatPaymentLabel(payments = [], fulfillment) {
  if (!payments || payments.length === 0) {
    return fulfillment === 'pickup' ? 'Paiement sur place' : 'À la livraison'
  }
  const latest = payments[payments.length - 1]
  const methodMap = {
    card_online: 'Carte en ligne',
    card_terminal: 'Terminal',
    cash: 'Espèces',
    interac: 'Interac',
  }
  const base = methodMap[latest.method] || 'Paiement'
  const statusMap = {
    pending: 'en attente',
    authorized: 'autorisé',
    paid: 'payé',
    refunded: 'remboursé',
    failed: 'échoué',
  }
  const suffix = statusMap[latest.status] ? ` · ${statusMap[latest.status]}` : ''
  const lastDigits = latest.last4 ? ` · · · · ${latest.last4}` : ''
  return `${base}${suffix}${lastDigits}`
}

function formatEventTitle(event, fulfillment) {
  if (!event) return 'Mise à jour'
  if (event.event_type === 'status_changed' && event.payload?.status) {
    if (event.payload.status === 'assigned') {
      return 'Le livreur se dirige vers le restaurant'
    }
    if (event.payload.status === 'enroute') {
      return 'Le livreur se dirige vers vous'
    }
    if (event.payload.status === 'ready') {
      return fulfillment === 'pickup' ? 'Prête pour la cueillette' : 'Prête'
    }
    return statusLabel(event.payload.status, fulfillment)
  }
  return event.event_type ? event.event_type.replace(/_/g, ' ') : 'Mise à jour'
}

function formatEventDescription(event) {
  if (!event?.payload) return ''
  if (typeof event.payload.failure_reason === 'string' && event.payload.failure_reason.trim().length > 0) {
    return event.payload.failure_reason
  }
  if (typeof event.payload.message === 'string') return event.payload.message
  if (typeof event.payload.note === 'string') return event.payload.note
  if (typeof event.payload.reason === 'string') return event.payload.reason
  return ''
}

function mapOrderPatch(row) {
  if (!row) return {}
  return {
    status: row.status,
    order_number: row.order_number,
    fulfillment: row.fulfillment,
    scheduled_at: row.scheduled_at,
    placed_at: row.placed_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    cancellation_reason: row.cancellation_reason,
    failure_reason: row.failure_reason,
    subtotal: row.subtotal,
    delivery_fee: row.delivery_fee,
    tip_amount: row.tip_amount,
    taxes: row.taxes,
    total: row.total,
    delivery_address: row.delivery_address,
    pickup_name: row.pickup_name,
    pickup_phone: row.pickup_phone,
    driver_id: row.driver_id,
  }
}

function buildLocalStatusEvent(status) {
  return {
    id: `local-status-${status}-${Date.now()}`,
    event_type: 'status_changed',
    payload: { status, source: 'auto-refresh' },
    created_at: new Date().toISOString(),
    __local: true,
  }
}

function normalizeStatus(status) {
  if (status === 'assigned') return 'ready'
  return status
}

function getFailedMessage(order) {
  if (!order || order.status !== 'failed') return ''
  const events = Array.isArray(order.events) ? order.events.slice().reverse() : []
  const failedEvent = events.find((event) => event.event_type === 'status_changed' && event.payload?.status === 'failed')
  if (failedEvent?.payload) {
    return (
      failedEvent.payload.failure_reason ||
      failedEvent.payload.message ||
      failedEvent.payload.note ||
      failedEvent.payload.reason ||
      ''
    )
  }
  return order.failure_reason || order.notes || ''
}

function normalizeDriverLocation(row) {
  if (!row) return null
  const lat = Number(row.lat)
  const lng = Number(row.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {
    lat,
    lng,
    updated_at: row.updated_at || null,
  }
}

const BASE_SPEED_KMH = 32
const BUFFER_SECONDS = 120

function computeDriverEtaSeconds({ status, driverPosition, restaurantPosition, destinationPosition }) {
  if (!driverPosition || !destinationPosition) return null
  const distanceToSeconds = (km) => (km / BASE_SPEED_KMH) * 3600

  if (status === 'assigned') {
    if (!restaurantPosition) return null
    const legToRestaurant = haversineDistanceKm(driverPosition, restaurantPosition)
    const legToCustomer = haversineDistanceKm(restaurantPosition, destinationPosition)
    if (!Number.isFinite(legToRestaurant) || !Number.isFinite(legToCustomer)) return null
    return Math.max(0, Math.round(distanceToSeconds(legToRestaurant + legToCustomer) + BUFFER_SECONDS))
  }

  if (status === 'enroute') {
    const legToCustomer = haversineDistanceKm(driverPosition, destinationPosition)
    if (!Number.isFinite(legToCustomer)) return null
    return Math.max(0, Math.round(distanceToSeconds(legToCustomer) + BUFFER_SECONDS))
  }

  return null
}

function haversineDistanceKm(a, b) {
  if (!a || !b) return NaN
  const toRad = (value) => (value * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const sinDlat = Math.sin(dLat / 2)
  const sinDlng = Math.sin(dLng / 2)
  const aVal = sinDlat * sinDlat + sinDlng * sinDlng * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal))
  return R * c
}
