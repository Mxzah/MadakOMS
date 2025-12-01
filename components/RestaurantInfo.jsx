import React, { useMemo, useState, useEffect } from 'react'
import styles from '../styles/RestaurantInfo.module.css'
import { useService } from '../context/ServiceContext'

export default function RestaurantInfo({
  name,
  address,
  schedule,
  defaultService = 'pickup',
  availableServices = ['delivery', 'pickup'],
  onServiceChange,
  estimatedDeliveryTimeMinutes,
  estimatedPrepTimeMinutes,
  phone,
  email,
}) {
  const [open, setOpen] = useState(false)
  const { service, setService } = useService()
  const normalizedServices = useMemo(() => {
    const allowed = ['delivery', 'pickup']
    if (!Array.isArray(availableServices)) return allowed
    const normalized = availableServices
      .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : null))
      .filter((value) => allowed.includes(value))
    return Array.from(new Set(normalized))
  }, [availableServices])
  const resolvedDefaultService = useMemo(() => {
    if (normalizedServices.length === 0) {
      return defaultService === 'pickup' ? 'pickup' : 'delivery'
    }
    if (normalizedServices.includes(defaultService)) return defaultService
    return normalizedServices[0]
  }, [defaultService, normalizedServices])
  const showDelivery = normalizedServices.includes('delivery')
  const showPickup = normalizedServices.includes('pickup')

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

  const estimatedTime = useMemo(() => {
    const prepTime = estimatedPrepTimeMinutes
    const deliveryTime = estimatedDeliveryTimeMinutes
    
    if (service === 'delivery' && prepTime != null && deliveryTime != null) {
      return prepTime + deliveryTime
    } else if (service === 'pickup' && prepTime != null) {
      return prepTime
    }
    return null
  }, [service, estimatedPrepTimeMinutes, estimatedDeliveryTimeMinutes])

  // If a page passes defaultService (like sante-taouk), set it on mount
  useEffect(() => {
    if (normalizedServices.length === 0) return
    if (resolvedDefaultService && (resolvedDefaultService === 'pickup' || resolvedDefaultService === 'delivery')) {
      setService(resolvedDefaultService)
      onServiceChange && onServiceChange(resolvedDefaultService)
    }
  }, [resolvedDefaultService, normalizedServices, onServiceChange, setService])

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
          {phone && (
            <div className={styles.contactInfo}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <a href={`tel:${phone}`}>{phone}</a>
            </div>
          )}
          {email && (
            <div className={styles.contactInfo}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="22,6 12,13 2,6" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <a href={`mailto:${email}`}>{email}</a>
            </div>
          )}
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

          {(showDelivery || showPickup) && (
            <div>
              <div className={styles.serviceSwitch} role="tablist" aria-label="Type de service">
                {showDelivery && (
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
                )}
                {showPickup && (
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
                    Cueillette
                  </button>
                )}
              </div>
              {estimatedTime != null && (
                <div className={styles.timeEstimate}>
                  Temps estimé: {estimatedTime} min
                </div>
              )}
            </div>
          )}
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
