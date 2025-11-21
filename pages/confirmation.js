import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Header from '../components/Header'
import { useCart } from '../context/CartContext'
import styles from '../styles/ConfirmationPage.module.css'

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
    if (!order?.payment) return '—'
    if (order.payment.mode === 'card_now') {
      const brand = order.payment.cardBrand === 'visa' ? 'Visa' : order.payment.cardBrand === 'mastercard' ? 'Mastercard' : 'Carte'
      return `${brand} · · · · ${order.payment.last4 || ''}`
    }
    if (order.payment.mode === 'cod') {
      return order.service === 'pickup' ? 'Paiement sur place' : (order.payment.method === 'cash' ? 'Espèces (à la livraison)' : 'Carte (à la livraison)')
    }
    if (order.payment.mode === 'pay_in_store') return 'Paiement sur place'
    return '—'
  }, [order])

  const items = order?.items || []
  const addressLine = useMemo(() => {
    if (!order) return '—'
    if (order.service === 'pickup') return 'Cueillette au restaurant'
    return order?.delivery?.address || '—'
  }, [order])

  return (
    <div>
      <Header name="Bon repas!" showCart={false} />
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
              <div className={styles.infoRow}><span>Courriel</span><strong>{order?.customer?.email || '—'}</strong></div>
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
                <div className={styles.metaVal}>{order?.orderId || '—'}</div>
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
                  <div className={styles.itemTotal}>${Number(l.total || 0).toFixed(2)}</div>
                </div>
              ))}
            </div>

            <div className={styles.sum}>
              <div className={styles.sumRow}><span>Sous-total</span><span>${Number(order?.amounts?.subtotal || 0).toFixed(2)}</span></div>
              <div className={styles.sumRow}><span>{order?.service === 'pickup' ? 'Frais' : 'Frais de livraison'}</span><span>${Number(order?.amounts?.deliveryFee || 0).toFixed(2)}</span></div>
              <div className={styles.sumRow}><span>Taxes</span><span>${Number(order?.amounts?.taxes || 0).toFixed(2)}</span></div>
              {order?.service !== 'pickup' && (
                <div className={styles.sumRow}><span>Pourboire</span><span>${Number(order?.amounts?.tip || 0).toFixed(2)}</span></div>
              )}
              <div className={styles.sumTotal}><span>Total</span><strong>${Number(order?.amounts?.total || 0).toFixed(2)}</strong></div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
