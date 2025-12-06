import React, { useEffect, useState, useMemo } from 'react'
import styles from '../styles/CartDrawer.module.css'
import { useCart } from '../context/CartContext'
import { useService } from '../context/ServiceContext'
import ItemModal from './ItemModal'
import { useRouter } from 'next/router'
import { formatPrice } from '../lib/currency'
import { isRestaurantOpenNow } from '../lib/hours'

export default function CartDrawer() {
  const {
    lines,
    subtotal,
    isOpen,
    closeCart,
    removeAt,
    updateAt,
    showGlobalLoading,
    hideGlobalLoading,
    checkoutBlock,
    setCheckoutBlock,
    restaurantSlug,
  } = useCart()
  const router = useRouter()
  const { service } = useService()
  const slug = typeof router?.query?.slug === 'string' ? router.query.slug : null
  const [storedSlug, setStoredSlug] = useState(null)
  const [editIndex, setEditIndex] = useState(null)
  const [restaurantSettings, setRestaurantSettings] = useState(null)

  const GROUP_LABELS = {
    size: 'Taille',
    remove: 'Retirer',
    add: 'Ajouter',
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') closeCart()
    }
    if (isOpen) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, closeCart])

  const onEdit = (idx) => setEditIndex(idx)
  const closeEdit = () => setEditIndex(null)

  useEffect(() => {
    if (slug) {
      setStoredSlug(slug)
      try {
        localStorage.setItem('lastRestaurantSlug', slug)
      } catch {}
      return
    }
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('lastRestaurantSlug') : null
      if (saved) setStoredSlug(saved)
    } catch {}
  }, [slug])

  // Load restaurant settings to check minimum order amount
  useEffect(() => {
    const activeSlug = slug || storedSlug || restaurantSlug
    if (!activeSlug) {
      setRestaurantSettings(null)
      return
    }

    let cancelled = false
    async function loadSettings() {
      try {
        const res = await fetch(`/api/restaurant/${activeSlug}/menu`)
        if (res.status === 404 || !res.ok) {
          if (!cancelled) setRestaurantSettings(null)
          return
        }
        const payload = await res.json()
        if (cancelled) return
        setRestaurantSettings(payload?.settings || null)
      } catch (error) {
        console.error('Failed to load restaurant settings in cart', error)
        if (!cancelled) setRestaurantSettings(null)
      }
    }

    loadSettings()
    return () => { cancelled = true }
  }, [slug, storedSlug, restaurantSlug])

  // Check if restaurant is closed and validate minimum order amount
  useEffect(() => {
    if (!setCheckoutBlock) return

    // If cart is empty or no settings, don't block
    if (lines.length === 0 || !restaurantSettings) {
      // Only clear specific blocks, not others
      setCheckoutBlock((prev) => {
        if (prev?.reason === 'min_order_amount' || prev?.reason === 'restaurant_closed') {
          return null
        }
        return prev
      })
      return
    }

    // Check if restaurant is closed
    const orderingDisabled = restaurantSettings?.ordering_enabled === false
    const hasHoursConfigured = Boolean(restaurantSettings?.hours_json)
    const closedBySchedule = hasHoursConfigured ? !isRestaurantOpenNow(restaurantSettings.hours_json, new Date()) : false
    const isClosed = orderingDisabled || closedBySchedule

    if (isClosed) {
      setCheckoutBlock((prev) => {
        // Only update if not already set to avoid unnecessary re-renders
        if (prev?.reason === 'restaurant_closed') return prev
        return {
          reason: 'restaurant_closed',
          message: 'Ce restaurant est actuellement fermé. Revenez plus tard pour passer votre commande.',
        }
      })
      return
    }

    // Check minimum order amount only if restaurant is open
    const minOrderAmount = service === 'delivery' 
      ? (restaurantSettings?.min_order_amount_delivery ?? null)
      : (restaurantSettings?.min_order_amount_pickup ?? null)
    
    if (minOrderAmount != null && Number.isFinite(Number(minOrderAmount)) && subtotal < Number(minOrderAmount)) {
      const serviceLabel = service === 'delivery' ? 'livraison' : 'cueillette'
      setCheckoutBlock((prev) => {
        // Only update if not already set to avoid unnecessary re-renders
        if (prev?.reason === 'min_order_amount' && prev?.message?.includes(serviceLabel)) return prev
        return {
          reason: 'min_order_amount',
          message: `Le montant minimum pour la ${serviceLabel} est de ${formatPrice(Number(minOrderAmount))}. Votre commande est de ${formatPrice(subtotal)}.`,
        }
      })
    } else {
      // Only clear the min order block, not other blocks
      setCheckoutBlock((prev) => {
        if (prev?.reason === 'min_order_amount') {
          return null
        }
        return prev
      })
    }
  }, [subtotal, service, restaurantSettings, lines.length, setCheckoutBlock])

  if (!isOpen) return null

  const checkoutDisabled = lines.length === 0 || Boolean(checkoutBlock)

  return (
    <div className={styles.backdrop} onClick={(e) => { if (e.target === e.currentTarget) closeCart() }}>
      <aside className={styles.panel} role="dialog" aria-modal="true" aria-label="Panier">
        <header className={styles.header}>
          <button className={styles.headerClose} onClick={closeCart} aria-label="Close">×</button>
          <h2 className={styles.title}>Votre commande</h2>
        </header>

        <div className={styles.content}>
          {lines.length === 0 && (
            <div className={styles.empty}>Votre panier est vide.</div>
          )}

          {lines.length > 0 && (
            <ul className={styles.list}>
              {lines.map((l, idx) => (
                <li key={l.key || idx} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <div>
                      <div className={styles.itemTitle}>{l.item?.title || l.item?.name || `Article #${l.itemId}`}</div>
                      <div className={styles.itemMeta}>
                        <span className={styles.unitPrice}>{formatPrice(l.unitPrice)} / unité</span>
                        <span className={styles.metaDivider} aria-hidden>•</span>
                        <span className={styles.qtyTag}>{l.qty} portion{l.qty > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className={styles.totalBlock}>
                      <span className={styles.totalLabel}>Total</span>
                      <span className={styles.totalValue}>{formatPrice(l.total)}</span>
                    </div>
                  </div>
                  {l.selections && (
                    (() => {
                      const entries = Object.entries(l.selections || {}).filter(([groupId, sel]) => {
                        // consider selectionLabels if present
                        const labels = l.selectionLabels?.[groupId]
                        if (Array.isArray(labels)) return labels.length > 0
                        if (Array.isArray(sel)) return sel.length > 0
                        return sel != null && sel !== ''
                      })
                      if (entries.length === 0) return null
                      return (
                        <div className={styles.options}>
                          {entries.map(([groupId, sel]) => (
                            <div key={groupId} className={styles.optionLine}>
                              <span className={styles.optionKey}>{(() => {
                                const fromLine = l.groupLabels?.[groupId]
                                if (fromLine) return fromLine
                                const fromItem = Array.isArray(l.item?.modifiers)
                                  ? l.item.modifiers.find((m) => String(m.id) === String(groupId))
                                  : null
                                if (fromItem?.name || fromItem?.title) return fromItem.name || fromItem.title
                                return GROUP_LABELS[groupId] || groupId
                              })()}:</span>
                              <span className={styles.optionVal}>
                                {(() => {
                                  const labels = l.selectionLabels?.[groupId]
                                  if (Array.isArray(labels) && labels.length) return labels.join(', ')
                                  return Array.isArray(sel) ? sel.join(', ') : String(sel)
                                })()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })()
                  )}
                  <div className={styles.itemActions}>
                    {slug && (
                      <button className={`${styles.actionBtn} ${styles.editBtn}`} onClick={() => onEdit(idx)} aria-label="Modifier l'article">
                        Modifier
                      </button>
                    )}
                    <button className={`${styles.actionBtn} ${styles.removeBtn}`} onClick={() => removeAt(idx)} aria-label="Remove item">
                      Retirer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className={styles.footer}>
          <div className={styles.subtotalRow}>
            <span>Sous-total</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>
          <button
            className={styles.cta}
            onClick={async () => {
              if (checkoutDisabled) return
              closeCart()
              showGlobalLoading()
              const query = service ? `?service=${encodeURIComponent(service)}` : ''
              const delay = new Promise((resolve) => setTimeout(resolve, 2000))
              try {
                const checkoutSlug = slug || storedSlug
                const targetPath = checkoutSlug ? `/restaurant/${checkoutSlug}/checkout${query}` : `/checkout${query}`
                await Promise.all([
                  router.push(targetPath),
                  delay,
                ])
              } catch (error) {
                console.error('Navigation vers la caisse échouée', error)
              } finally {
                hideGlobalLoading()
              }
            }}
            disabled={checkoutDisabled}
          >
            Continuer
          </button>
          {checkoutBlock?.message && (
            <div className={styles.blockNote} role="alert">
              {checkoutBlock.message}
            </div>
          )}
        </footer>

        {editIndex != null && lines[editIndex] && slug && (
          <ItemModal
            item={lines[editIndex].item}
            slug={slug}
            defaultSelections={lines[editIndex].selections}
            defaultQty={lines[editIndex].qty}
            confirmLabel="Mettre à jour"
            allowZeroQty
            onClose={closeEdit}
            onConfirm={({ itemId, qty, unitPrice, selections, selectionLabels, groupLabels }) => {
              if (qty === 0) {
                removeAt(editIndex)
              } else {
                updateAt(editIndex, { itemId, qty, unitPrice, selections, selectionLabels, groupLabels, item: lines[editIndex].item })
              }
              setEditIndex(null)
            }}
          />
        )}
      </aside>
    </div>
  )
}
