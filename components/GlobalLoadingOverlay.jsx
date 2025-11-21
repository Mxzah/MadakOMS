import React from 'react'
import { useCart } from '../context/CartContext'
import styles from '../styles/GlobalLoadingOverlay.module.css'

export default function GlobalLoadingOverlay() {
  const { isGlobalLoading } = useCart()
  if (!isGlobalLoading) return null
  return (
    <div className={styles.overlay} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.spinner} aria-hidden="true" />
      <span>Veuillez patienter…</span>
    </div>
  )
}

