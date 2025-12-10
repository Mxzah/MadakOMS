import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Header from '../components/Header'
import { useCart } from '../context/CartContext'
import styles from '../styles/ConfirmationPage.module.css'
import { formatPrice } from '../lib/currency'

export default function ConfirmationPage() {
  const [order, setOrder] = useState(null)
  const router = useRouter()
  const { showGlobalLoading, hideGlobalLoading } = useCart()

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? sessionStorage.getItem('madakoms:lastOrder') : null
      if (raw) setOrder(JSON.parse(raw))
    } catch {}
  }, [])

  const dateStr = useMemo(() => {
    if (!order?.timestamp) return new Date().toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' })
    return new Date(order.timestamp).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' })
  }, [order?.timestamp])

  const subcopy = useMemo(() => {
    if (!order) return "Nous commençons à préparer votre commande. Vous recevrez une notification lorsqu’elle sera prête."
    if (order.service === 'pickup') {
      return "Nous commençons à préparer votre commande. Vous recevrez une notification lorsqu’elle sera prête pour la cueillette."
    }
    let text = "Nous commençons à préparer votre commande. Vous recevrez une notification lorsque votre commande sera en route."
    const scheduled = order?.delivery?.deliveryMode === 'scheduled' && order?.delivery?.schedule?.summary
    if (scheduled) text += ` Fenêtre prévue : ${order.delivery.schedule.summary}.`
    return text
  }, [order])

  const payLabel = useMemo(() => {
    // Vérifier dans order.payment d'abord, puis dans order.backendOrder.payment
    const payment = order?.payment || order?.backendOrder?.payment || null
    
    // Debug: log pour voir la structure
    if (process.env.NODE_ENV === 'development' && order) {
      console.log('Order payment data:', { payment: order.payment, backendPayment: order.backendOrder?.payment, fullOrder: order })
    }
    
    if (!payment) {
      // Si pas de payment, vérifier si on peut déduire du backendOrder
      const backendOrder = order?.backendOrder
      if (backendOrder?.payment_mode) {
        const mode = backendOrder.payment_mode
        if (mode === 'card_online' || mode === 'card_now') {
          return 'Carte en ligne'
        }
        if (mode === 'cod') {
          const service = order?.service || backendOrder?.fulfillment || 'delivery'
          return service === 'pickup' ? 'Paiement sur place' : 'Paiement à la livraison'
        }
        if (mode === 'pay_in_store') {
          return 'Paiement sur place'
        }
      }
      return '—'
    }
    
    const mode = payment.mode || payment.payment_mode || null
    if (!mode) {
      // Si pas de mode mais qu'on a des infos de carte, c'est probablement card_now
      if (payment.cardBrand || payment.last4 || payment.hasCard) {
        const brand = payment.cardBrand === 'visa' ? 'Visa' : payment.cardBrand === 'mastercard' ? 'Mastercard' : 'Carte'
        const last4 = payment.last4 || payment.last_4 || ''
        return last4 ? `${brand} · · · · ${last4}` : `${brand}`
      }
      return '—'
    }
    
    if (mode === 'card_now' || mode === 'card_online') {
      const brand = payment.cardBrand === 'visa' ? 'Visa' : payment.cardBrand === 'mastercard' ? 'Mastercard' : 'Carte'
      const last4 = payment.last4 || payment.last_4 || ''
      return last4 ? `${brand} · · · · ${last4}` : `${brand}`
    }
    
    if (mode === 'cod') {
      const method = payment.method || payment.payment_method || 'cash'
      const service = order?.service || order?.backendOrder?.fulfillment || 'delivery'
      if (service === 'pickup') {
        return 'Paiement sur place'
      }
      return method === 'cash' ? 'Espèces (à la livraison)' : 'Carte (à la livraison)'
    }
    
    if (mode === 'pay_in_store' || mode === 'pay_in_restaurant') {
      return 'Paiement sur place'
    }
    
    // Fallback pour d'autres modes
    if (typeof mode === 'string') {
      return mode.charAt(0).toUpperCase() + mode.slice(1).replace(/_/g, ' ')
    }
    
    return '—'
  }, [order])

  const items = order?.items || []
  const addressLine = useMemo(() => {
    if (!order) return '—'
    if (order.service === 'pickup') return 'Cueillette au restaurant'
    return order?.delivery?.address || '—'
  }, [order])

  const displayOrderNumber = useMemo(() => {
    if (!order) return null
    return (
      order.orderNumber ||
      order.order_number ||
      order.backendOrder?.orderNumber ||
      order.backendOrder?.order_number ||
      order.orderId ||
      null
    )
  }, [order])

  return (
    <div>
      <Header name="Confirmation de commande" showCart={false} />
      <main className={styles.wrapper}>
        <section className={styles.left}>
          <h2 className={styles.thankYou}>Merci pour votre commande!</h2>
          <p className={styles.subcopy}>{subcopy}</p>

          <div className={styles.block}>
            <div className={styles.blockTitle}>Coordonnées</div>
            <div className={styles.infoGrid}>
              <div className={styles.infoRow}><span>Nom</span><strong>{order?.customer?.firstName || '—'}</strong></div>
              <div className={styles.infoRow}><span>Adresse</span><strong>{addressLine}</strong></div>
              <div className={styles.infoRow}><span>Téléphone</span><strong>{order?.customer?.phone || '—'}</strong></div>
              {order?.customer?.email && (
                <div className={styles.infoRow}><span>Courriel</span><strong>{order.customer.email}</strong></div>
              )}
            </div>
          </div>

          <button
            className={styles.trackBtn}
            type="button"
            onClick={async () => {
              if (!order?.orderId) return
              showGlobalLoading()
              try {
                await router.push(`/orders/${encodeURIComponent(order.orderId)}`)
              } finally {
                hideGlobalLoading()
              }
            }}
          >
            Suivre ma commande
          </button>
        </section>

        <aside className={styles.right}>
          <div className={styles.receipt}>
            <div className={styles.receiptHeader}>Résumé de commande</div>
            <div className={styles.metaRow}>
              <div>
                <div className={styles.metaKey}>Date</div>
                <div className={styles.metaVal}>{dateStr}</div>
              </div>
              <div>
                <div className={styles.metaKey}>Numéro</div>
                <div className={styles.metaVal}>{displayOrderNumber || '—'}</div>
              </div>
              <div>
                <div className={styles.metaKey}>Paiement</div>
                <div className={styles.metaVal}>{payLabel}</div>
              </div>
            </div>

            <div className={styles.items}>
              {items.map((l, i) => (
                <div className={styles.itemRow} key={i}>
                  <div className={styles.itemMain}>
                    <div className={styles.itemTitle}>{l.title}</div>
                    <div className={styles.itemMeta}>Qté: {l.qty}</div>
                  </div>
                  <div className={styles.itemTotal}>{formatPrice(l.total)}</div>
                </div>
              ))}
            </div>

            <div className={styles.sum}>
              <div className={styles.sumRow}><span>Sous-total</span><span>{formatPrice(order?.amounts?.subtotal)}</span></div>
              <div className={styles.sumRow}><span>{order?.service === 'pickup' ? 'Frais' : 'Frais de livraison'}</span><span>{formatPrice(order?.amounts?.deliveryFee)}</span></div>
              <div className={styles.sumRow}><span>Taxes</span><span>{formatPrice(order?.amounts?.taxes)}</span></div>
              {order?.service !== 'pickup' && (
                <div className={styles.sumRow}><span>Pourboire</span><span>{formatPrice(order?.amounts?.tip)}</span></div>
              )}
              <div className={styles.sumTotal}><span>Total</span><strong>{formatPrice(order?.amounts?.total)}</strong></div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
