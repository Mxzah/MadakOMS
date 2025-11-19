import React, { useEffect, useState } from 'react'
import styles from '../styles/CartDrawer.module.css'
import { useCart } from '../context/CartContext'
import { useService } from '../context/ServiceContext'
import ItemModal from './ItemModal'
import { useRouter } from 'next/router'

function formatCAD(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)
}

export default function CartDrawer() {
  const { lines, subtotal, isOpen, closeCart, removeAt, updateAt } = useCart()
  const router = useRouter()
  const { service } = useService()
  const slug = router?.query?.slug
  const [editIndex, setEditIndex] = useState(null)

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

  if (!isOpen) return null

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
                  <div className={styles.itemMain}>
                    <div className={styles.itemTitle}>{l.item?.title || l.item?.name || `Article #${l.itemId}`}</div>
                    <div className={styles.itemMeta}>
                      <span className={styles.qty}>{l.qty} × {formatCAD(l.unitPrice)}</span>
                      <span className={styles.total}>{formatCAD(l.total)}</span>
                      {slug && (
                        <button className={styles.editBtn} onClick={() => onEdit(idx)} aria-label="Modifier l'article">Modifier</button>
                      )}
                      <button className={styles.removeBtn} onClick={() => removeAt(idx)} aria-label="Remove item">×</button>
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
                              <span className={styles.optionKey}>{GROUP_LABELS[groupId] ?? groupId}:</span>
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
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className={styles.footer}>
          <div className={styles.subtotalRow}>
            <span>Sous-total</span>
            <strong>{formatCAD(subtotal)}</strong>
          </div>
          <button
            className={styles.cta}
            onClick={() => {
              closeCart()
              // Preserve service selection when navigating
              const query = service ? `?service=${encodeURIComponent(service)}` : ''
              router.push(`/checkout${query}`)
            }}
            disabled={lines.length === 0}
          >
            Continuer
          </button>
        </footer>

        {editIndex != null && lines[editIndex] && slug && (
          <ItemModal
            item={lines[editIndex].item}
            slug={slug}
            defaultSelections={lines[editIndex].selections}
            defaultQty={lines[editIndex].qty}
            confirmLabel="Mettre à jour"
            onClose={closeEdit}
            onConfirm={({ itemId, qty, unitPrice, selections, selectionLabels }) => {
              updateAt(editIndex, { itemId, qty, unitPrice, selections, selectionLabels, item: lines[editIndex].item })
              setEditIndex(null)
            }}
          />
        )}
      </aside>
    </div>
  )
}
