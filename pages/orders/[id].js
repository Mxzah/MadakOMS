import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Header from '../../components/Header'
import styles from '../../styles/OrderTrackPage.module.css'
import { supabaseClient } from '../../lib/supabase/client'
import { formatPrice } from '../../lib/currency'

const DELIVERY_FLOW = ['received', 'preparing', 'ready', 'enroute', 'completed']
const PICKUP_FLOW = ['received', 'preparing', 'ready', 'completed']

function statusLabel(status, fulfillment) {
  switch (status) {
    case 'received':
      return 'Reçue'
    case 'preparing':
      return 'En préparation'
    case 'ready':
      return fulfillment === 'pickup' ? 'Prête pour cueillette' : 'Prête'
    case 'enroute':
      return 'En route'
    case 'completed':
      return fulfillment === 'pickup' ? 'Récupérée' : 'Livrée'
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

  const steps = useMemo(() => {
    const base = order?.fulfillment === 'pickup' ? PICKUP_FLOW : DELIVERY_FLOW
    if (order?.status === 'cancelled' && !base.includes('cancelled')) {
      return [...base, 'cancelled']
    }
    return base
  }, [order?.fulfillment, order?.status])

  const currentIdx = useMemo(() => {
    if (!order?.status) return 0
    const idx = steps.indexOf(order.status)
    return idx === -1 ? 0 : idx
  }, [steps, order?.status])
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
    if (!order) return '—'
    if (order.fulfillment === 'pickup') return 'N/A'
    if (!order.scheduled_at) return 'Dès que possible'
    return formatDateTime(order.scheduled_at)
  }, [order])

  useEffect(() => {
    if (!order?.status) return
    if (lastStatusRef.current && lastStatusRef.current !== order.status) {
      const statusForEvent = order.status
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
    lastStatusRef.current = order.status
  }, [order?.status])

  return (
    <div>
      <Header name="Suivi de commande" showCart={false} />
      <main className={styles.wrapper}>
        <section className={styles.left}>
          <h2 className={styles.title}>Commande {orderNumberLabel || id || ''}</h2>
          {order?.restaurant?.name && <p className={styles.subtitle}>{order.restaurant.name}</p>}
          {order && (
            <div className={`${styles.statusBadge} ${order.status === 'cancelled' ? styles.statusBadgeDanger : ''}`}>
              {statusLabel(order.status, order.fulfillment)}
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
                          ].join(' ').trim()}
                          aria-hidden
                        />
                      )}
                    </React.Fragment>
                  )
                })}
              </div>

              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span>Numéro</span>
                  <strong>{orderNumberLabel || (orderNumber ? orderNumber : '—')}</strong>
                </div>
                <div className={styles.metaItem}>
                  <span>Commandée le</span>
                  <strong>{formatDateTime(order.placed_at)}</strong>
                </div>
                <div className={styles.metaItem}>
                  <span>Fenêtre prévue</span>
                  <strong>{scheduledLabel}</strong>
                </div>
                <div className={styles.metaItem}>
                  <span>Adresse / retrait</span>
                  <strong>{deliveryLine}</strong>
                </div>
                <div className={styles.metaItem}>
                  <span>Instructions</span>
                  <strong>{order.delivery_address?.instructions || '—'}</strong>
                </div>
              </div>

              <div className={styles.eventsSection}>
                <div className={styles.eventsTitle}>Activité récente</div>
                {(!order.events || order.events.length === 0) && (
                  <div className={styles.emptyState}>Aucune mise à jour pour le moment.</div>
                )}
                {order.events && order.events.length > 0 && (
                  <div className={styles.eventsList}>
                    {order.events.map((event) => (
                      <div key={event.id} className={styles.eventRow}>
                        <div className={styles.eventTime}>{formatDateTime(event.created_at, { dateStyle: 'short', timeStyle: 'short' })}</div>
                        <div className={styles.eventTitle}>{formatEventTitle(event, order.fulfillment)}</div>
                        {formatEventDescription(event) && (
                          <div className={styles.eventDesc}>{formatEventDescription(event)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
                <div className={styles.row}><span>Client</span><strong>{order.pickup_name || order.delivery_address?.address || '—'}</strong></div>
                <div className={styles.row}><span>Téléphone</span><strong>{order.pickup_phone || '—'}</strong></div>
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
    return statusLabel(event.payload.status, fulfillment)
  }
  return event.event_type ? event.event_type.replace(/_/g, ' ') : 'Mise à jour'
}

function formatEventDescription(event) {
  if (!event?.payload) return ''
  if (typeof event.payload.message === 'string') return event.payload.message
  if (typeof event.payload.note === 'string') return event.payload.note
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
    subtotal: row.subtotal,
    delivery_fee: row.delivery_fee,
    tip_amount: row.tip_amount,
    taxes: row.taxes,
    total: row.total,
    delivery_address: row.delivery_address,
    pickup_name: row.pickup_name,
    pickup_phone: row.pickup_phone,
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
