import React, { useMemo, useState, useEffect } from 'react'
import styles from '../styles/RestaurantInfo.module.css'
import { useService } from '../context/ServiceContext'

export default function RestaurantInfo({ name, address, schedule, defaultService = 'pickup', onServiceChange }) {
  const [open, setOpen] = useState(false)
  const { service, setService } = useService()

  const todayKey = useMemo(() => {
    const idx = new Date().getDay() // 0=dimanche
    const map = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    return map[idx]
  }, [])

  const todayValue = schedule?.[todayKey] ?? '—'

  const initials = useMemo(() => {
    if (!name) return 'R'
    const parts = name.split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] || ''
    const second = parts[1]?.[0] || ''
    return (first + second).toUpperCase()
  }, [name])

  // If a page passes defaultService (like sante-taouk), set it on mount
  useEffect(() => {
    if (defaultService && (defaultService === 'pickup' || defaultService === 'delivery')) {
      setService(defaultService)
      onServiceChange && onServiceChange(defaultService)
    }
  }, [defaultService])

  return (
    <section className={styles.wrapper}>
      <div className={styles.topRow}>
        <div className={styles.logo} aria-hidden>
          {initials}
        </div>

        <div className={styles.meta}>
          <h2 className={styles.title}>{name}</h2>
          <div className={styles.address}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="10" r="2.5" stroke="#666" strokeWidth="1.5"/>
            </svg>
            <span>{address}</span>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.hoursBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.clockIcon}>
              <circle cx="12" cy="12" r="8.5" stroke="#555" strokeWidth="1.5"/>
              <path d="M12 7.5V12l3 2.2" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className={styles.hoursLabel}>Horaires</span>
            <span className={styles.todayValue}>{todayKey} · {todayValue}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
              <path d="M7 10l5 5 5-5" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className={styles.serviceSwitch} role="tablist" aria-label="Type de service">
            <button
              type="button"
              role="tab"
              aria-selected={service === 'delivery'}
              className={`${styles.pill} ${service === 'delivery' ? styles.active : ''}`}
              onClick={() => {
                setService('delivery')
                onServiceChange && onServiceChange('delivery')
              }}
            >
              Livraison
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={service === 'pickup'}
              className={`${styles.pill} ${service === 'pickup' ? styles.active : ''}`}
              onClick={() => {
                setService('pickup')
                onServiceChange && onServiceChange('pickup')
              }}
            >
              Sur place
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className={styles.schedulePanel} role="region" aria-label="Horaires de la semaine">
          {['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'].map((d) => (
            <div key={d} className={`${styles.row} ${d === todayKey ? styles.todayRow : ''}`}>
              <span className={styles.day}>{capitalize(d)}</span>
              <span className={styles.time}>{schedule?.[d] || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
