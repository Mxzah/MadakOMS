import React, { useEffect, useMemo, useState } from 'react'
import styles from '../styles/ItemModal.module.css'
import { formatPrice } from '../lib/currency'

export default function ItemModal({
  item,
  slug,
  onClose,
  onConfirm,
  defaultSelections = {},
  defaultQty = 1,
  confirmLabel,
  allowZeroQty = false,
}) {
  const basePrice = useMemo(() => item?.price ?? item?.base_price ?? 0, [item])
  const title = item?.title ?? item?.name ?? ''
  const description = item?.description ?? item?.short_description ?? ''
  const categoryLabel = item?.category?.name ?? item?.category_name ?? null
  const imageUrl = item?.imageUrl ?? item?.image_url ?? ''
  const minQty = allowZeroQty ? 0 : 1
  const [groups, setGroups] = useState([])
  const [qty, setQty] = useState(Math.max(minQty, Number(defaultQty) || 1))
  const [selected, setSelected] = useState(defaultSelections || {})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Lock body scroll while modal is open (mobile fix)
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    const prevTouch = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.touchAction = prevTouch
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch(`/api/restaurant/${slug}/item/${item.id}/options`)
        const data = await res.json()
        if (!cancelled) {
          setGroups(Array.isArray(data.groups) ? data.groups : [])
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setGroups([])
          setLoading(false)
          setError('')
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug, item?.id])

  function toggleMulti(groupId, optionId) {
    setSelected((prev) => {
      const set = new Set(prev[groupId] || [])
      if (set.has(optionId)) set.delete(optionId)
      else set.add(optionId)
      return { ...prev, [groupId]: Array.from(set) }
    })
  }

  function setSingle(groupId, optionId) {
    setSelected((prev) => ({ ...prev, [groupId]: optionId }))
  }

  const price = useMemo(() => {
    let extra = 0
    for (const g of groups) {
      if (g.type === 'single') {
        const sel = selected[g.id]
        const opt = g.options?.find((o) => o.id === sel)
        if (opt) extra += Number(opt.price_delta || 0)
      } else if (g.type === 'multi') {
        const sels = selected[g.id] || []
        for (const id of sels) {
          const opt = g.options?.find((o) => o.id === id)
          if (opt) extra += Number(opt.price_delta || 0)
        }
      }
    }
    return (basePrice + extra) * qty
  }, [groups, selected, qty, basePrice])

  const valid = useMemo(() => {
    for (const g of groups) {
      if (g.type === 'single') {
        if (g.required && !selected[g.id]) return false
      } else if (g.type === 'multi') {
        const count = (selected[g.id] || []).length
        if (g.required && count < (g.min || 0)) return false
        if (typeof g.min === 'number' && count < g.min) return false
        if (typeof g.max === 'number' && count > g.max) return false
      }
    }
    return true
  }, [groups, selected])

  function submit() {
    if (!valid && !(allowZeroQty && qty === 0)) return
    const selectionLabels = {}
    const groupLabels = {}
    for (const g of groups) {
      groupLabels[g.id] = g.title || g.name || g.label || g.id
      if (g.type === 'single') {
        const sel = selected[g.id]
        if (sel != null) {
          const opt = g.options?.find((o) => o.id === sel)
          selectionLabels[g.id] = [opt?.label ?? String(sel)]
        }
      } else if (g.type === 'multi') {
        const sels = Array.isArray(selected[g.id]) ? selected[g.id] : []
        const labels = sels.map((id) => {
          const opt = g.options?.find((o) => o.id === id)
          return opt?.label ?? String(id)
        })
        if (labels.length) selectionLabels[g.id] = labels
      }
    }
    const unit = qty === 0 ? basePrice : (price / qty)
    const payload = { itemId: item.id, qty, selections: selected, selectionLabels, groupLabels, unitPrice: unit, total: price }
    onConfirm?.(payload)
  }

  const actionText = (qty === 0 && allowZeroQty)
    ? 'Retirer du panier'
    : `${confirmLabel || 'Ajouter au panier'} — ${formatPrice(price)}`

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">×</button>

        <div className={styles.layout}>
          <aside className={styles.mediaColumn}>
            <div className={styles.mediaCard}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {imageUrl ? (
                <img src={imageUrl} alt={title} />
              ) : (
                <div className={styles.mediaFallback}>{title.charAt(0).toUpperCase()}</div>
              )}
            </div>
            <div className={styles.priceCard}>
              <span className={styles.priceHint}>À partir de</span>
              <strong className={styles.priceValue}>{formatPrice(basePrice)}</strong>
              <p className={styles.priceNote}>Le prix peut varier selon les options.</p>
            </div>
          </aside>

          <section className={styles.contentColumn}>
            <header className={styles.header}>
              {categoryLabel && <span className={styles.category}>{categoryLabel}</span>}
              <h2 className={styles.title}>{title}</h2>
              {description && <p className={styles.description}>{description}</p>}
              {error && <p className={styles.error}>{error}</p>}
            </header>

            <div className={styles.optionsArea}>
              {loading && <div className={styles.loading}>Chargement…</div>}
              {!loading && groups.length === 0 && <div className={styles.empty}>Aucune option pour cet article.</div>}

              {groups.map((g) => (
                <div key={g.id} className={styles.group}>
                  <div className={styles.groupHeader}>
                    <h3 className={styles.groupTitle}>{g.title}</h3>
                    <span className={styles.groupMeta}>
                      {g.required ? 'Requis' : 'Optionnel'}
                      {g.type === 'multi' && (g.min || g.max) ? ` • ${g.min || 0}-${g.max || '∞'} choix` : ''}
                    </span>
                  </div>

                  {g.type === 'single' && (
                    <div className={styles.radioList}>
                      {g.options?.map((o) => (
                        <label key={o.id} className={styles.choiceRow}>
                          <input
                            type="radio"
                            name={`g-${g.id}`}
                            checked={selected[g.id] === o.id}
                            onChange={() => setSingle(g.id, o.id)}
                          />
                          <span className={styles.choiceLabel}>{o.label}</span>
                          {o.price_delta ? <span className={styles.choicePrice}>+{formatPrice(o.price_delta)}</span> : null}
                        </label>
                      ))}
                    </div>
                  )}

                  {g.type === 'multi' && (
                    <div className={styles.checkboxList}>
                      {g.options?.map((o) => {
                        const checked = (selected[g.id] || []).includes(o.id)
                        return (
                          <label key={o.id} className={styles.choiceRow}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMulti(g.id, o.id)}
                            />
                            <span className={styles.choiceLabel}>{o.label}</span>
                            {o.price_delta ? <span className={styles.choicePrice}>+{formatPrice(o.price_delta)}</span> : null}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.footer}>
          <div className={styles.qtyRow}>
            <button onClick={() => setQty((q) => Math.max(minQty, q - 1))} className={styles.qtyBtn} aria-label="Moins">−</button>
            <span className={styles.qty}>{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className={styles.qtyBtn} aria-label="Plus">+</button>
          </div>
          <button className={styles.addBtn} disabled={!valid && !(allowZeroQty && qty === 0)} onClick={submit}>
            {actionText}
          </button>
        </div>
      </div>
    </div>
  )
}
