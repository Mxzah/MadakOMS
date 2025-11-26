import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Header from '../components/Header'
import styles from '../styles/ApprovalPage.module.css'
import { supabaseClient } from '../lib/supabase/client'

const STATUS_RECEIVED = 'received'
const STATUS_CANCELLED = 'cancelled'

function formatElapsed(totalSeconds) {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (value) => String(value).padStart(2, '0')
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}

const persistLastOrder = (record) => {
  if (typeof window === 'undefined' || !record) return
  try {
    window.sessionStorage.setItem('madakoms:lastOrder', JSON.stringify(record))
  } catch {}
}

export default function ApprovalPage() {
  const router = useRouter()
  const [order, setOrder] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (!router.isReady) return
    if (typeof window === 'undefined') return
    let parsed = null
    try {
      const raw = window.sessionStorage.getItem('madakoms:lastOrder')
      if (raw) parsed = JSON.parse(raw)
    } catch {}

    if (!parsed?.orderId) {
      router.replace('/confirmation').catch(() => {})
      return
    }

    setOrder(parsed)
    setInitializing(false)
  }, [router])

  useEffect(() => {
    if (!order?.timestamp) {
      setElapsedSeconds(0)
      return
    }
    const startAt = new Date(order.timestamp).getTime()
    const base = Number.isFinite(startAt) ? startAt : Date.now()
    const tick = () => {
      const delta = Math.max(0, Math.floor((Date.now() - base) / 1000))
      setElapsedSeconds(delta)
    }
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [order?.timestamp])

  useEffect(() => {
    if (!order) return
    persistLastOrder(order)
  }, [order])

  const applyRemotePatch = useCallback((patch) => {
    if (!patch) return
    setOrder((prev) => {
      if (!prev) return prev
      const nextStatus = patch.status || prev.status
      const nextService = patch.fulfillment ? (patch.fulfillment === 'pickup' ? 'pickup' : 'delivery') : prev.service
      const nextTimestamp = patch.placed_at || prev.timestamp
      const hasAmountFields = ['subtotal', 'delivery_fee', 'taxes', 'tip_amount', 'total'].some((key) => patch[key] != null)
      const nextAmounts = hasAmountFields
        ? {
            subtotal: patch.subtotal ?? prev?.amounts?.subtotal ?? 0,
            deliveryFee: patch.delivery_fee ?? prev?.amounts?.deliveryFee ?? 0,
            taxes: patch.taxes ?? prev?.amounts?.taxes ?? 0,
            tip: patch.tip_amount ?? prev?.amounts?.tip ?? 0,
            total: patch.total ?? prev?.amounts?.total ?? 0,
          }
        : prev.amounts
      const backendOrder = patch.id ? { ...(prev.backendOrder || {}), ...patch } : prev.backendOrder
      const nextCancellationReason = Object.prototype.hasOwnProperty.call(patch, 'cancellation_reason')
        ? patch.cancellation_reason
        : prev.cancellation_reason
      const changed =
        nextStatus !== prev.status ||
        nextService !== prev.service ||
        nextTimestamp !== prev.timestamp ||
        backendOrder !== prev.backendOrder ||
        nextAmounts !== prev.amounts ||
        nextCancellationReason !== prev.cancellation_reason
      if (!changed) return prev
      return {
        ...prev,
        status: nextStatus,
        service: nextService,
        timestamp: nextTimestamp,
        backendOrder,
        amounts: nextAmounts,
        cancellation_reason: nextCancellationReason,
      }
    })
  }, [])

  const syncOrderStatus = useCallback(
    async ({ silent = false } = {}) => {
      const orderId = order?.orderId
      if (!orderId) return
      if (!silent) {
        setError('')
      }
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`)
        const payload = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(payload?.error || 'Impossible de récupérer la commande.')
        }
        applyRemotePatch(payload || {})
      } catch (err) {
        if (!silent) {
          setError(err?.message || 'Impossible de synchroniser la commande.')
        } else {
          // eslint-disable-next-line no-console
          console.warn('Order approval sync failed', err)
        }
      }
    },
    [applyRemotePatch, order?.orderId]
  )

  useEffect(() => {
    if (!order?.orderId) return undefined
    let active = true
    syncOrderStatus()
    const interval = window.setInterval(() => {
      if (active) syncOrderStatus({ silent: true })
    }, 30000)

    let channel = null
    try {
      channel = supabaseClient
        .channel(`order-approval-${order.orderId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${order.orderId}` }, (payload) => {
          if (!payload?.new) return
          applyRemotePatch(payload.new)
        })
        .subscribe()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Unable to subscribe to approvals', err)
    }

    return () => {
      active = false
      window.clearInterval(interval)
      if (channel) {
        try {
          supabaseClient.removeChannel(channel)
        } catch {}
      }
    }
  }, [applyRemotePatch, order?.orderId, syncOrderStatus])

  useEffect(() => {
    if (!order?.status || redirecting) return
    if (order.status !== STATUS_RECEIVED && order.status !== STATUS_CANCELLED) {
      setRedirecting(true)
      router.replace('/confirmation').catch(() => setRedirecting(false))
    }
  }, [order?.status, redirecting, router])

  const elapsedLabel = useMemo(() => formatElapsed(elapsedSeconds), [elapsedSeconds])
  const orderNumberLabel = useMemo(() => {
    if (!order) return null
    return (
      order.orderNumber ||
      order.order_number ||
      order.backendOrder?.orderNumber ||
      order.backendOrder?.order_number ||
      null
    )
  }, [order])
  const placedLabel = useMemo(() => {
    if (!order?.timestamp) return 'juste maintenant'
    const date = new Date(order.timestamp)
    if (Number.isNaN(date.getTime())) return 'juste maintenant'
    return date.toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short', hour12: false })
  }, [order?.timestamp])

  const isCancelled = order?.status === STATUS_CANCELLED
  const cancellationReason = order?.cancellation_reason || order?.backendOrder?.cancellation_reason || ''

  const homePath = useMemo(() => {
    const primary = order?.restaurantSlug
    const secondary = order?.restaurant?.slug || order?.backendOrder?.restaurant?.slug
    const slug = primary || secondary
    if (slug) return `/restaurant/${encodeURIComponent(slug)}`
    return '/'
  }, [order])

  const handleGoHome = useCallback(() => {
    router.push(homePath).catch(() => {})
  }, [homePath, router])

  if (initializing) {
    return (
      <div>
        <Header name="Commande en attente" showCart={false} />
        <main className={styles.wrapper}>
          <div className={styles.card}>
            <div className={styles.subtitle}>Chargement de votre commande…</div>
          </div>
        </main>
      </div>
    )
  }

  const headingText = isCancelled
    ? 'Votre commande a été annulée.'
    : 'Nous attendons l’approbation du restaurant.'
  const subtitleText = isCancelled
    ? 'L’annulation est maintenant confirmée. Vous pouvez consulter ci-dessous le message transmis par notre équipe.'
    : `Votre commande a bien été transmise${orderNumberLabel ? ` (#${orderNumberLabel})` : ''}. Dès qu’elle passe en préparation, nous vous redirigerons vers le récapitulatif complet.`
  const infoText = isCancelled
    ? 'Cette page reste disponible afin que vous puissiez consulter les détails de l’annulation.'
    : `Votre commande a bien été reçue le ${placedLabel}. Nous vérifions automatiquement l’état de votre commande pour vous.`
  const hintText = isCancelled
    ? 'Besoin d’aide supplémentaire ? Contactez-nous et mentionnez votre numéro de commande.'
    : 'Vous resterez sur cette page tant que notre équipe n’a pas approuvé votre commande. Nous actualisons automatiquement toutes les 30 secondes.'

  return (
    <div>
      <Header name="Commande en attente" showCart={false} />
      <main className={styles.wrapper}>
        <div className={styles.card}>
          {isCancelled && (
            <div className={styles.cancelBanner} role="alert">
              <div className={styles.cancelTitle}>Commande annulée</div>
              <div className={styles.cancelMessage}>
                {cancellationReason
                  ? `Message de notre équipe : ${cancellationReason}`
                  : "Cette commande a été annulée par l'équipe du restaurant."}
              </div>
            </div>
          )}
          <div className={`${styles.statusBadge} ${isCancelled ? styles.statusBadgeDanger : ''}`.trim()}>
            <span className={`${styles.statusDot} ${isCancelled ? styles.statusDotDanger : ''}`.trim()} aria-hidden />
            {isCancelled ? 'Commande annulée' : 'Commande reçue'}
          </div>
          <h2 className={styles.title}>{headingText}</h2>
          <p className={styles.subtitle}>{subtitleText}</p>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.timerBlock}>
            <div className={styles.timerLabel}>Temps écoulé depuis la commande</div>
            <div className={styles.timerValue}>{elapsedLabel}</div>
          </div>

          <p className={styles.infoText}>{infoText}</p>

          {isCancelled && (
            <div className={styles.actions}>
              <button type="button" className={styles.primaryBtn} onClick={handleGoHome}>
                Retourner à l&apos;accueil
              </button>
            </div>
          )}

          <div className={styles.hint}>{hintText}</div>
        </div>
      </main>
    </div>
  )
}

