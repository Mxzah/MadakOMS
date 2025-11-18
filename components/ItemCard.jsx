import React from 'react'
import styles from '../styles/ItemCard.module.css'

function formatCAD(value) {
  if (typeof value !== 'number') return value
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)
}

export default function ItemCard({ item, onAdd }) {
  const { title, description, price, imageUrl } = item

  const handleAdd = () => onAdd?.(item)
  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <article
      className={styles.card}
      role="button"
      tabIndex={0}
      aria-label={`Ajouter ${title}`}
      onClick={handleAdd}
      onKeyDown={handleKey}
    >
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        {description && <p className={styles.desc}>{description}</p>}

        <div className={styles.metaRow}>
          <span className={styles.price}>{formatCAD(price)}</span>
        </div>

        {/* Badge supprimé sur demande */
        }
      </div>

      <div className={styles.imageWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={title} className={styles.image} />
        <button
          className={styles.addBtn}
          onClick={(e) => { e.stopPropagation(); handleAdd() }}
          aria-label={`Ajouter ${title}`}
        >
          <PlusIcon />
        </button>
      </div>
    </article>
  )
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="#111" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
