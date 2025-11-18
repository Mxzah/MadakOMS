import React from 'react'
import styles from '../styles/Header.module.css'

export default function Header({ name = 'Restaurant', cartSubtotal = 0, cartCount = 0 }) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>{name}</h1>
      </div>

      <div className={styles.right}>
        <div className={styles.cart}>
          <button className={styles.cartButton} aria-label="Cart">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 6h15l-1.5 9h-12L6 6z" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="20" r="1" fill="white" />
              <circle cx="18" cy="20" r="1" fill="white" />
            </svg>
            {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
          </button>

          <div className={styles.cartInfo}>
            <span className={styles.subtotal}>Subtotal</span>
            <span className={styles.amount}>${cartSubtotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
