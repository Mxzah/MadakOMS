import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Header from '../../components/Header'
import styles from '../../styles/OrderTrackPage.module.css'

const STATUS_FLOW = ['received', 'preparing', 'ready', 'enroute', 'delivered']

function statusLabel(s, service) {
  switch (s) {
    case 'received': return 'Reçue'
    case 'preparing': return 'En préparation'
    case 'ready': return service === 'pickup' ? 'Prête pour cueillette' : 'Prête'
    case 'enroute': return 'En route'
    case 'delivered': return service === 'pickup' ? 'Récupérée' : 'Livrée'
    default: return '—'
  }
}

export default function OrderTrackPage() {
  const router = useRouter()
  const { id } = router.query
  const [order, setOrder] = useState(null)

  // Load order from local/session storage
  useEffect(() => {
    if (!id) return
    try {
      const rawList = localStorage.getItem('madakoms:orders')
      const list = Array.isArray(JSON.parse(rawList)) ? JSON.parse(rawList) : []
      const found = list.find((o) => o.orderId === id)
      if (found) { setOrder(found); return }
      const last = sessionStorage.getItem('madakoms:lastOrder')
      if (last) {
        const parsed = JSON.parse(last)
        if (parsed?.orderId === id) setOrder(parsed)
      }
    } catch {}
  }, [id])

  // Simulate real-time updates via storage event
  useEffect(() => {
    function onStorage() {
      if (!id) return
      try {
        const rawList = localStorage.getItem('madakoms:orders')
        const list = Array.isArray(JSON.parse(rawList)) ? JSON.parse(rawList) : []
        const found = list.find((o) => o.orderId === id)
        if (found) setOrder(found)
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    const t = setInterval(onStorage, 2000)
    return () => { window.removeEventListener('storage', onStorage); clearInterval(t) }
  }, [id])

  const steps = useMemo(() => STATUS_FLOW.filter((s) => s !== 'enroute' || order?.service !== 'pickup'), [order?.service])
  const currentIdx = useMemo(() => Math.max(0, steps.indexOf(order?.status || 'received')), [steps, order?.status])

  function simulateAdvance() {
    if (!order) return
    const idx = Math.min(currentIdx + 1, steps.length - 1)
    const next = { ...order, status: steps[idx] }
    setOrder(next)
    try {
      const rawList = localStorage.getItem('madakoms:orders')
      const list = Array.isArray(JSON.parse(rawList)) ? JSON.parse(rawList) : []
      const updated = list.map((o) => o.orderId === next.orderId ? next : o)
      localStorage.setItem('madakoms:orders', JSON.stringify(updated))
    } catch {}
  }

  return (
    <div>
      <Header name="Suivi de commande" showCart={false} />
      <main className={styles.wrapper}>
        <section className={styles.left}>
          <h2 className={styles.title}>Commande {id || ''}</h2>
          <div className={styles.timeline}>
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div className={`${styles.step} ${i <= currentIdx ? styles.stepDone : ''}`}>
                  <div className={styles.dot} />
                  <div className={styles.label}>{statusLabel(s, order?.service)}</div>
                </div>
                {i < steps.length - 1 && (
                  <div className={`${styles.connector} ${i < currentIdx ? styles.connectorDone : ''}`} aria-hidden />
                )}
              </React.Fragment>
            ))}
          </div>
          <button type="button" className={styles.simBtn} onClick={simulateAdvance}>Simuler l'avancement</button>
        </section>

        <aside className={styles.right}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Détails</div>
            <div className={styles.row}><span>Service</span><strong>{order?.service === 'pickup' ? 'Cueillette' : 'Livraison'}</strong></div>
            <div className={styles.row}><span>Paiement</span><strong>{order?.payment?.mode === 'card_now' ? 'Paiement en ligne' : (order?.service === 'pickup' ? 'Sur place' : 'À la livraison')}</strong></div>
            <div className={styles.row}><span>Total</span><strong>${Number(order?.amounts?.total || 0).toFixed(2)}</strong></div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Articles</div>
            {(order?.items || []).map((l, i) => (
              <div className={styles.itemRow} key={i}>
                <div className={styles.itemName}>{l.title}</div>
                <div className={styles.itemMeta}>Qté: {l.qty}</div>
                <div className={styles.itemPrice}>${Number(l.total || 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  )
}
