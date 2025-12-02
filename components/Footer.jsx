import React from 'react'
import styles from '../styles/Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <a href="mailto:madak@madakenterprise.ca" className={styles.email}>
        madak@madakenterprise.ca
      </a>
    </footer>
  )
}

