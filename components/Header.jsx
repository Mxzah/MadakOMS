import React from 'react'
import styles from '../styles/Header.module.css'
import { useCart } from '../context/CartContext'
import { formatPrice } from '../lib/currency'

export default function Header({ name = 'Restaurant', showCart = true, onBack = null }) {
  const { subtotal, count, openCart } = useCart()
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {onBack && (
          <button className={styles.iconButton} onClick={onBack} aria-label="Retour" style={{marginRight:10}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <h1 className={styles.title}>{name}</h1>
      </div>

      {showCart && (
        <div className={styles.right}>
          <div className={styles.cart}>
            <button className={styles.cartButton} aria-label="Cart" onClick={openCart}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 6h15l-1.5 9h-12L6 6z" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="20" r="1" fill="white" />
                <circle cx="18" cy="20" r="1" fill="white" />
              </svg>
              {count > 0 && <span className={styles.badge}>{count}</span>}
            </button>

            <div className={styles.cartInfo}>
              <span className={styles.subtotal}>Sous-total</span>
              <span className={styles.amount}>{formatPrice(subtotal)}</span>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
