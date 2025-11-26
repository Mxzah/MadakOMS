import React, { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Header from '../../../components/Header'
import { useService } from '../../../context/ServiceContext'
import { useCart } from '../../../context/CartContext'
import styles from '../../../styles/CheckoutPage.module.css'
import { useRouter } from 'next/router'
import ItemModal from '../../../components/ItemModal'
import { extractPolygonsFromGeoJson, pointInPolygons } from '../../../lib/geo'
import { formatPrice } from '../../../lib/currency'

const CheckoutMap = dynamic(() => import('../../../components/CheckoutMap'), { ssr: false })

export default function CheckoutPage() {
  const { subtotal, lines, updateAt, removeAt, clear, showGlobalLoading, hideGlobalLoading, setRestaurantSlug } = useCart()
  const router = useRouter()
  const { service, setService } = useService()
  const emptyRedirectChecked = useRef(false)
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [addressDraft, setAddressDraft] = useState('')
  const [instructions, setInstructions] = useState('')
  const [apartmentSuite, setApartmentSuite] = useState('')
  const [dropOption, setDropOption] = useState('door') // 'hand' | 'door'
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [addressLat, setAddressLat] = useState(null)
  const [addressLng, setAddressLng] = useState(null)
  const [withinArea, setWithinArea] = useState(null) // null: unknown, true/false: evaluated
  const [deliveryMode, setDeliveryMode] = useState(null) // null | 'standard' | 'scheduled'
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleDayIndex, setScheduleDayIndex] = useState(0) // index into remaining days
  const [scheduleSlot, setScheduleSlot] = useState(null) // { start: Date, end: Date }
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [settingsIssues, setSettingsIssues] = useState([])
  const [deliveryPolygons, setDeliveryPolygons] = useState([])
  const [operatingWindows, setOperatingWindows] = useState({})
  const [allowedServices, setAllowedServices] = useState(['delivery', 'pickup'])
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!router.isReady) return
    if (emptyRedirectChecked.current) return
    if (lines && lines.length > 0) {
      emptyRedirectChecked.current = true
      return
    }
    if ((!lines || lines.length === 0) && !isPlacingOrder) {
      emptyRedirectChecked.current = true
      router.replace('/').catch(() => {})
    }
  }, [lines?.length, router.isReady, isPlacingOrder, router])

  const dayNames = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

  const remainingWeekDays = useMemo(() => {
    const today = new Date()
    const list = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d)
      const weekday = date.getDay()
      const windows = operatingWindows?.[weekday]
      if (Array.isArray(windows) && windows.length > 0) list.push(date)
    }
    return list
  }, [operatingWindows])

  const currentSlots = useMemo(() => {
    const targetDate = remainingWeekDays[scheduleDayIndex]
    if (!targetDate) return []
    return buildSlotsForDate(targetDate, operatingWindows)
  }, [remainingWeekDays, scheduleDayIndex, operatingWindows])
  const slotLabel = (slot) => {
    const fmt = (d) => d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${fmt(slot.start)}-${fmt(slot.end)}`
  }
  const scheduledSummary = useMemo(() => {
    if (deliveryMode !== 'scheduled' || !scheduleSlot) return null
    const date = remainingWeekDays[scheduleDayIndex]
    if (!date) return null
    const dateLabel = date.toLocaleDateString('fr-CA', { weekday: 'short', month: 'short', day: 'numeric' })
    return `${dateLabel} ${slotLabel(scheduleSlot)}`
  }, [deliveryMode, scheduleSlot, scheduleDayIndex, remainingWeekDays])

  useEffect(() => {
    if (remainingWeekDays.length === 0) {
      setScheduleDayIndex(0)
      setScheduleSlot(null)
      return
    }
    if (scheduleDayIndex >= remainingWeekDays.length) {
      setScheduleDayIndex(0)
      setScheduleSlot(null)
    }
  }, [remainingWeekDays, scheduleDayIndex])

  // Reset selection if area becomes unavailable
  useEffect(() => {
    if (!withinArea) {
      setDeliveryMode(null)
      setShowScheduleModal(false)
      setScheduleSlot(null)
    }
  }, [withinArea])
  const deliverySummary = () => {
    if (!apartmentSuite && !instructions) return 'Ajouter plus de détails'
    const parts = []
    if (apartmentSuite) parts.push(apartmentSuite)
    if (dropOption) parts.push(dropOption === 'hand' ? 'Main propre' : 'À la porte')
    if (instructions) parts.push(instructions.length > 40 ? instructions.slice(0,40) + '…' : instructions)
    return parts.join(' · ')
  }

  const handleOpenAddressModal = () => {
    setAddressDraft(address)
    setAddrSelectionError('')
    setShowAddressModal(true)
  }

  const handleCloseAddressModal = (nextDraft) => {
    setShowAddressModal(false)
    setAddrOpen(false)
    setAddressDraft(nextDraft ?? address)
    setAddrSelectionError('')
  }

  const persistOrderLocally = (record) => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem('madakoms:lastOrder', JSON.stringify(record))
    } catch {}
    try {
      const raw = window.localStorage.getItem('madakoms:orders')
      const parsed = raw ? JSON.parse(raw) : []
      const list = Array.isArray(parsed) ? parsed : []
      list.unshift(record)
      window.localStorage.setItem('madakoms:orders', JSON.stringify(list))
    } catch {
      try { window.localStorage.setItem('madakoms:orders', JSON.stringify([record])) } catch {}
    }
  }
  const [tipPreset, setTipPreset] = useState(0.18)
  const [tipCustom, setTipCustom] = useState('')

  // Address autocomplete state
  const [addrOpen, setAddrOpen] = useState(false)
  const [addrLoading, setAddrLoading] = useState(false)
  const [addrResults, setAddrResults] = useState([])
  const [addrSelectionError, setAddrSelectionError] = useState('')
  const addrAbort = useRef(null)
  const debounceRef = useRef(null)

  const deliveryFee = 3.99
  const tip = useMemo(() => {
    if (service === 'pickup') return 0
    if (tipCustom !== '' && !Number.isNaN(Number(tipCustom))) return Math.max(0, Number(tipCustom))
    return Math.round((subtotal * tipPreset) * 100) / 100
  }, [subtotal, tipPreset, tipCustom, service])

  const taxes = useMemo(() => {
    const rate = 0.14975
    return Math.round(((subtotal + deliveryFee) * rate) * 100) / 100
  }, [subtotal])

  const total = useMemo(() => Math.round((subtotal + deliveryFee + taxes + tip) * 100) / 100, [subtotal, deliveryFee, taxes, tip])

  // Submit handler: log order info to console
  const handlePlaceOrder = async () => {
    setOrderError('')
    if (!validateSection1()) {
      setOpenSection(1)
      return
    }
    if (service !== 'pickup' && !validateSection2()) {
      setOpenSection(2)
      return
    }
    if (service !== 'pickup' && deliveryMode === 'scheduled' && !scheduleSlot) {
      setShowScheduleModal(true)
      setOpenSection(2)
      return
    }
    if (paymentMode === 'now' && !hasCard) {
      setPaymentError('Ajoutez une carte pour payer maintenant.')
      setOpenSection(service === 'pickup' ? 2 : 3)
      return
    }

    const items = (lines || []).map((l) => ({
      itemId: l.itemId ?? l.item?.id ?? null,
      title: l.item?.title || l.item?.name || `Article #${l.itemId ?? ''}`,
      qty: l.qty,
      unitPrice: l.unitPrice,
      total: l.total,
      selections: l.selections || null,
      selectionLabels: l.selectionLabels || null,
      groupLabels: l.groupLabels || null,
    }))

    const schedule = (deliveryMode === 'scheduled' && scheduleSlot)
      ? {
          dayIndex: scheduleDayIndex,
          start: scheduleSlot.start?.toISOString?.() || null,
          end: scheduleSlot.end?.toISOString?.() || null,
          summary: scheduledSummary,
        }
      : null

    const delivery = (service !== 'pickup')
      ? {
          address: address || null,
          lat: addressLat,
          lng: addressLng,
          apartmentSuite: apartmentSuite || null,
          dropOption,
          instructions: instructions || null,
          withinArea,
          deliveryMode,
          schedule,
        }
      : null

    const payment = (paymentMode === 'now')
      ? { mode: 'card_now', hasCard, cardBrand, last4 }
      : { mode: service === 'pickup' ? 'pay_in_store' : 'cod', method: codMethod }

    const baseOrder = {
      service,
      customer: { firstName, email, phone },
      delivery,
      payment,
      items,
      amounts: {
        subtotal,
        deliveryFee,
        taxes,
        tip,
        total,
      },
      timestamp: new Date().toISOString(),
    }

    try {
      // eslint-disable-next-line no-console
      console.log('Order submission:', baseOrder)
    } catch {}

    showGlobalLoading()
    setIsPlacingOrder(true)
    try {
      const response = await fetch(`/api/restaurant/${activeSlug}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(baseOrder),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Impossible de soumettre la commande.')
      }
      if (!payload) {
        throw new Error('Réponse invalide du serveur.')
      }

      const orderId = payload.id || `CMD-${Math.floor(Date.now() / 1000)}`
      const orderNumber = payload.orderNumber ?? payload.order_number ?? null
      const syncedAmounts = {
        subtotal: payload.subtotal ?? baseOrder.amounts.subtotal,
        deliveryFee: payload.deliveryFee ?? baseOrder.amounts.deliveryFee,
        taxes: payload.taxes ?? baseOrder.amounts.taxes,
        tip: payload.tipAmount ?? baseOrder.amounts.tip,
        total: payload.total ?? baseOrder.amounts.total,
      }
      const backendOrderPayload = {
        ...payload,
        order_number: payload.order_number ?? payload.orderNumber ?? null,
      }

      const persisted = {
        ...baseOrder,
        orderId,
        orderNumber,
        status: payload.status || 'received',
        amounts: syncedAmounts,
        backendOrder: backendOrderPayload,
        restaurantSlug: activeSlug,
        timestamp: payload.placedAt || baseOrder.timestamp,
      }

      persistOrderLocally(persisted)
      clear()
      await router.push('/approbation')
    } catch (err) {
      const message = err?.message || 'Erreur lors de la soumission de la commande.'
      setOrderError(message)
    } finally {
      setIsPlacingOrder(false)
      hideGlobalLoading()
    }
  }

  // Retrieve slug for editing items
  const [slug, setSlug] = useState(null)
  const [editIndex, setEditIndex] = useState(null)
  const [openSection, setOpenSection] = useState(1) // dynamic: when pickup -> 1: compte, 2: paiement, 3: commande; when delivery -> 1: compte, 2: livraison, 3: paiement, 4: commande
  const [hasCard, setHasCard] = useState(false)
  const [last4, setLast4] = useState('')
  const [cardBrand, setCardBrand] = useState(null) // 'visa' | 'mastercard' | null
  const [cardErrors, setCardErrors] = useState({ number: '', cvc: '', exp: '', zip: '' })
  const [paymentMode, setPaymentMode] = useState('now') // 'now' | 'cod'
  const [codMethod, setCodMethod] = useState('cash') // 'cash' | 'card'
  const [showCardModal, setShowCardModal] = useState(false)
  const [errors, setErrors] = useState({})
  const [paymentError, setPaymentError] = useState('')
  useEffect(() => {
    try {
      const s = typeof window !== 'undefined' ? localStorage.getItem('lastRestaurantSlug') : null
      if (s) setSlug(s)
    } catch {}
  }, [])

  const routeSlug = typeof router?.query?.slug === 'string' ? router.query.slug : null

  useEffect(() => {
    if (!router?.isReady) return
    if (routeSlug && routeSlug !== slug) {
      setSlug(routeSlug)
    }
  }, [router?.isReady, routeSlug, slug])

  const editingSlug = routeSlug || slug
  const activeSlug = editingSlug || 'sante-taouk'

  useEffect(() => {
    if (!activeSlug) return
    setRestaurantSlug(activeSlug)
  }, [activeSlug, setRestaurantSlug])

  useEffect(() => {
    if (!activeSlug) return
    let cancelled = false

    async function loadSettings() {
      setSettingsLoading(true)
      setSettingsError('')
      setSettingsIssues([])
      setNotFound(false)
      try {
        const res = await fetch(`/api/restaurant/${activeSlug}/menu`)
        if (res.status === 404) {
          if (!cancelled) {
            setNotFound(true)
            setDeliveryPolygons([])
            setOperatingWindows({})
            setAllowedServices(['delivery', 'pickup'])
            setSettingsIssues([])
          }
          return
        }
        if (!res.ok) throw new Error('HTTP non OK')
        const payload = await res.json()
        if (cancelled) return
        const polygons = extractPolygonsFromGeoJson(payload?.settings?.delivery_zones_geojson)
        const windows = normalizeOperatingWindows(payload?.settings?.hours_json)
        const services = normalizeServiceTypes(payload?.settings?.service_types)
        setDeliveryPolygons(polygons)
        setOperatingWindows(windows)
        setAllowedServices(services)
        const warnings = []
        if (!payload.settings) {
          warnings.push('Paramètres du restaurant introuvables. Configurez les réglages dans Supabase.')
        } else {
          if (polygons.length === 0) warnings.push('Aucune zone de livraison trouvée dans Supabase.')
          if (Object.keys(windows).length === 0) warnings.push('Les horaires ne sont pas configurés pour la planification des livraisons.')
        }
        setSettingsIssues(warnings)
      } catch (error) {
        console.error('Checkout settings load failed.', error)
        if (cancelled) return
        setSettingsError('Impossible de charger les paramètres du restaurant. Veuillez réessayer plus tard.')
        setDeliveryPolygons([])
        setOperatingWindows({})
        setAllowedServices(['delivery', 'pickup'])
        setSettingsIssues([])
      } finally {
        if (!cancelled) setSettingsLoading(false)
      }
    }

    loadSettings()
    return () => { cancelled = true }
  }, [activeSlug])

  useEffect(() => {
    if (!allowedServices || allowedServices.length === 0) return
    if (!service || allowedServices.includes(service)) return
    setService(allowedServices[0])
  }, [allowedServices, service, setService])

  const handleBackToHome = () => {
    router.push('/').catch(() => {})
  }

  const GROUP_LABELS = {
    size: 'Taille',
    remove: 'Retirer',
    add: 'Ajouter',
  }

  // Validation helpers
  const validateSection1 = () => {
    const nextErrors = {}
    if (!firstName || firstName.trim().length === 0) nextErrors.firstName = 'Le prénom est requis.'
    // Phone: require at least 10 digits
    const digits = (phone || '').replace(/\D/g, '')
    if (!digits || digits.length < 10) nextErrors.phone = 'Numéro de téléphone invalide.'
    setErrors((prev) => ({ ...prev, ...nextErrors }))
    return Object.keys(nextErrors).length === 0
  }
  const validateSection2 = () => {
    const nextErrors = {}
    if (!address || address.trim().length < 5) {
      nextErrors.address = 'Adresse de livraison requise.'
    }
    if (addressLat != null && addressLng != null) {
      if (!deliveryPolygons || deliveryPolygons.length === 0) {
        nextErrors.serviceArea = 'Les zones de livraison ne sont pas configurées.'
        setWithinArea(null)
      } else {
        const inside = pointInPolygons(addressLat, addressLng, deliveryPolygons)
        setWithinArea(inside)
        if (!inside) {
          nextErrors.serviceArea = 'Adresse hors zone de livraison.'
        }
      }
    } else if (address) {
      nextErrors.serviceArea = 'Sélectionnez une adresse valide dans la liste.'
    }
    if (nextErrors.address) setAddrOpen(true)
    setErrors((prev) => ({ ...prev, ...nextErrors }))
    return Object.keys(nextErrors).length === 0
  }

  const requestOpenSection = (target) => {
    if (target <= openSection) { setOpenSection(target); return }
    // Gate progress by validations
    if (!validateSection1()) { setOpenSection(1); return }
    // When delivery, require address validation before moving past shipping; skip for pickup
    if (service !== 'pickup' && target >= 2 && !validateSection2()) { setOpenSection(2); return }
    setOpenSection(target)
  }

  useEffect(() => {
    if (addressLat == null || addressLng == null) {
      setWithinArea(null)
      return
    }
    if (!deliveryPolygons || deliveryPolygons.length === 0) {
      setWithinArea(null)
      return
    }
    setWithinArea(pointInPolygons(addressLat, addressLng, deliveryPolygons))
  }, [addressLat, addressLng, deliveryPolygons])

  // Autocomplete: query Photon API
  useEffect(() => {
    if (!addrOpen) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!addressDraft || addressDraft.trim().length < 3) {
      setAddrResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        if (addrAbort.current) addrAbort.current.abort()
        addrAbort.current = new AbortController()
        setAddrLoading(true)
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(addressDraft)}&lang=fr&limit=5`
        const res = await fetch(url, { signal: addrAbort.current.signal })
        const json = await res.json()
        const items = (json.features || []).map(f => {
          const [lng, lat] = f.geometry.coordinates
          const p = f.properties || {}
          const parts = [p.name, p.housenumber, p.street].filter(Boolean)
          const city = [p.city || p.town || p.village, p.state].filter(Boolean).join(', ')
          const country = p.country
          const label = [parts.join(' '), city, country].filter(Boolean).join(', ')
          return { label, lat, lng }
        })
        setAddrResults(items)
      } catch (e) {
        if (e.name !== 'AbortError') {
          setAddrResults([])
        }
      } finally {
        setAddrLoading(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (addrAbort.current) addrAbort.current.abort()
    }
  }, [addressDraft, addrOpen])

  // Dynamic section indices depending on service
  const idxShipping = 2
  const idxPayment = service === 'pickup' ? 2 : 3
  const idxSummary = service === 'pickup' ? 3 : 4

  if (notFound) {
    return (
      <div>
        <Header name="Vérifier votre commande" showCart={false} onBack={handleBackToHome} />
        <main className={styles.notFoundWrapper}>
          <div className={styles.notFoundCard}>
            <div className={styles.notFoundIcon} aria-hidden="true">🥣</div>
            <h2 className={styles.notFoundTitle}>Restaurant introuvable</h2>
            <p className={styles.notFoundText}>Le restaurant demandé n'existe pas ou n'est plus disponible.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div>
      <Header name="Vérifier votre commande" showCart={false} onBack={() => router.back()} />
      <main className={styles.wrapper}>
        <div className={styles.left}>
        {settingsError && (
          <div className={styles.settingsAlert} role="alert">{settingsError}</div>
        )}
        {settingsLoading && !settingsError && settingsIssues.length === 0 && (
          <div className={styles.settingsAlert} role="status">Chargement des paramètres…</div>
        )}
        {settingsIssues.length > 0 && !settingsError && (
          <div className={styles.settingsAlert} role="alert">
            {settingsIssues.map((msg, idx) => (
              <p key={`${msg}-${idx}`}>{msg}</p>
            ))}
          </div>
        )}
        {/* 1. Account details */}
        <section className={styles.section}>
          <div className={styles.sectionHeader} onClick={() => requestOpenSection(1)} role="button" tabIndex={0}>
            <div className={styles.sectionTitle}><span className={styles.sectionIndex}>1</span> Informations personnelles</div>
            <div className={styles.sectionRight}>{email ? email : ''}</div>
          </div>
          {openSection === 1 && (
            <>
              <div className={styles.form}>
                <div className={styles.field}>
                  <label>Prénom</label>
                  <input
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); setErrors((prev)=>({ ...prev, firstName: undefined })) }}
                    placeholder="Votre prénom"
                    aria-invalid={errors.firstName ? 'true' : 'false'}
                    className={errors.firstName ? styles.inputError : undefined}
                  />
                  {errors.firstName && <div className={styles.errorText}>{errors.firstName}</div>}
                </div>
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label>Courriel (facultatif)</label>
                    <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@example.com" />
                  </div>
                  <div className={styles.field}>
                    <label>Numéro de téléphone</label>
                    <input
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setErrors((prev)=>({ ...prev, phone: undefined })) }}
                      placeholder="(819) 555-0123"
                      aria-invalid={errors.phone ? 'true' : 'false'}
                      className={errors.phone ? styles.inputError : undefined}
                    />
                    {errors.phone && <div className={styles.errorText}>{errors.phone}</div>}
                  </div>
                </div>
              </div>
              <div className={styles.sectionFooter}>
                <button type="button" className={styles.nextBtn} onClick={() => { if (validateSection1()) setOpenSection(2) }}>Suivant</button>
              </div>
            </>
          )}
        </section>

        {/* 2. Shipping details (hidden for pickup) */}
        {service !== 'pickup' && (
        <section className={styles.section}>
          <div className={styles.sectionHeader} onClick={() => requestOpenSection(idxShipping)} role="button" tabIndex={0}>
            <div className={styles.sectionTitle}><span className={styles.sectionIndex}>2</span> Détails de livraison</div>
          </div>
          {openSection === idxShipping && (
            <>

              {/* Address card opens modal */}
              <div className={`${styles.rowItem} ${styles.clickableRow}`} onClick={handleOpenAddressModal} role="button" tabIndex={0}>
                <div className={styles.rowMain}>
                  <svg className={styles.rowIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M5 9.77746V16.2C5 17.8802 5 18.7203 5.32698 19.362C5.6146 19.9265 6.07354 20.3854 6.63803 20.673C7.27976 21 8.11984 21 9.8 21H14.2C15.8802 21 16.7202 21 17.362 20.673C17.9265 20.3854 18.3854 19.9265 18.673 19.362C19 18.7203 19 17.8802 19 16.2V5.00002M21 12L15.5668 5.96399C14.3311 4.59122 13.7133 3.90484 12.9856 3.65144C12.3466 3.42888 11.651 3.42893 11.0119 3.65159C10.2843 3.90509 9.66661 4.59157 8.43114 5.96452L3 12M14 21V15H10V21" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div className={styles.rowText}>
                    <div className={styles.rowTitle}>{address || 'Choisissez votre adresse de livraison'}</div>
                    <div className={styles.rowSub}>{address ? 'Shawinigan-Sud, QC, Canada' : 'Cliquez pour saisir une adresse'}</div>
                  </div>
                </div>
                <button type="button" className={styles.arrowBtn} aria-label="Modifier l'adresse" onClick={(e) => { e.stopPropagation(); handleOpenAddressModal() }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 5l7 7-7 7" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              {withinArea === false && <div className={styles.errorText} style={{marginTop:'4px'}}>Adresse hors zone de livraison.</div>}

              {/* Delivery instructions row */}
              <div className={`${styles.rowItem} ${styles.clickableRow}`} onClick={() => setShowDeliveryModal(true)} role="button" tabIndex={0}>
                <div className={styles.rowMain}>
                  <svg className={styles.rowIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M9 11V6C9 4.34315 10.3431 3 12 3C13.6569 3 15 4.34315 15 6V10.9673M10.4 21H13.6C15.8402 21 16.9603 21 17.816 20.564C18.5686 20.1805 19.1805 19.5686 19.564 18.816C20 17.9603 20 16.8402 20 14.6V12.2C20 11.0799 20 10.5198 19.782 10.092C19.5903 9.71569 19.2843 9.40973 18.908 9.21799C18.4802 9 17.9201 9 16.8 9H7.2C6.0799 9 5.51984 9 5.09202 9.21799C4.71569 9.40973 4.40973 9.71569 4.21799 10.092C4 10.5198 4 11.0799 4 12.2V14.6C4 16.8402 4 17.9603 4.43597 18.816C4.81947 19.5686 5.43139 20.1805 6.18404 20.564C7.03968 21 8.15979 21 10.4 21Z" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div className={styles.rowText}>
                    <div className={styles.rowTitle}>Instructions de dépôt</div>
                    <div className={styles.rowSub}>{deliverySummary()}</div>
                  </div>
                </div>
                <button type="button" className={styles.arrowBtn} aria-label="Ouvrir" onClick={(e) => { e.stopPropagation(); setShowDeliveryModal(true) }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 5l7 7-7 7" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Move Standard / Planifier below instructions */}
              <div className={styles.segRow}>
                <button
                  type="button"
                  className={`${styles.segBtn} ${withinArea && deliveryMode==='standard' ? styles.segBtnActive:''}`}
                  aria-disabled={withinArea ? 'false':'true'}
                  aria-pressed={deliveryMode==='standard'}
                  onClick={() => { if (withinArea) setDeliveryMode('standard') }}
                >
                  <div style={{fontWeight:600}}>Standard</div>
                  <div style={{color: withinArea && deliveryMode==='standard' ? '#fff': withinArea ? '#374151':'#9ca3af',fontSize:12}}>{withinArea ? 'Disponible' : 'Indisponible'}</div>
                </button>
                <button
                  type="button"
                  className={`${styles.segBtn} ${withinArea && deliveryMode==='scheduled' ? styles.segBtnActive:''}`}
                  aria-disabled={withinArea ? 'false':'true'}
                  aria-pressed={deliveryMode==='scheduled'}
                  onClick={() => { if (withinArea) { setDeliveryMode('scheduled'); setShowScheduleModal(true) } }}
                >
                  <div style={{fontWeight:600}}>Planifier</div>
                  <div style={{color: withinArea && deliveryMode==='scheduled' ? '#fff': withinArea ? '#374151':'#9ca3af',fontSize:12}}>
                    {withinArea ? (scheduledSummary || (currentSlots.length > 0 ? 'Disponible' : 'Aucun créneau')) : 'Indisponible'}
                  </div>
                </button>
              </div>

              {/* Phone row removed as requested */}

              <div className={styles.sectionFooter}>
                <button type="button" className={styles.nextBtn} onClick={() => { if (validateSection2()) setOpenSection(3) }}>Suivant</button>
              </div>
            </>
          )}
        </section>
        )}

        {/* 3 (or 2). Payment details */}
        <section className={styles.section}>
          <div className={styles.sectionHeader} onClick={() => requestOpenSection(idxPayment)} role="button" tabIndex={0}>
            <div className={styles.sectionTitle}><span className={styles.sectionIndex}>{service === 'pickup' ? '2' : '3'}</span> Détails de paiement</div>
          </div>
          {openSection === idxPayment && (
            <>
              <div className={styles.segRow}>
                <button type="button" className={`${styles.segBtn} ${paymentMode==='now' ? styles.segBtnActive : ''}`} onClick={()=>{ setPaymentMode('now'); setPaymentError('') }}>Payer maintenant</button>
                <button type="button" className={`${styles.segBtn} ${paymentMode==='cod' ? styles.segBtnActive : ''}`} onClick={()=>{ setPaymentMode('cod'); setPaymentError('') }}>
                  {service === 'pickup' ? 'Payer sur place' : 'Payer à la livraison'}
                </button>
              </div>

              {paymentMode === 'now' && hasCard && (
                <div className={styles.rowItem} style={{borderTop:'none',paddingTop:12,marginTop:4}}>
                  <div className={`${styles.rowMain} ${styles.cardRowMain}`} aria-pressed="true">
                    <span className={styles.rowIcon} aria-hidden="true">
                      {cardBrand === 'visa' && (
                        <svg viewBox="0 -11 70 70" xmlns="http://www.w3.org/2000/svg" className={styles.cardIcon}>
                          <rect x="0.5" y="0.5" width="69" height="47" rx="5.5" fill="white" stroke="#D9D9D9"/>
                          <path fillRule="evenodd" clipRule="evenodd" d="M21.2505 32.5165H17.0099L13.8299 20.3847C13.679 19.8267 13.3585 19.3333 12.8871 19.1008C11.7106 18.5165 10.4142 18.0514 9 17.8169V17.3498H15.8313C16.7742 17.3498 17.4813 18.0514 17.5991 18.8663L19.2491 27.6173L23.4877 17.3498H27.6104L21.2505 32.5165ZM29.9675 32.5165H25.9626L29.2604 17.3498H33.2653L29.9675 32.5165ZM38.4467 21.5514C38.5646 20.7346 39.2717 20.2675 40.0967 20.2675C41.3931 20.1502 42.8052 20.3848 43.9838 20.9671L44.6909 17.7016C43.5123 17.2345 42.216 17 41.0395 17C37.1524 17 34.3239 19.1008 34.3239 22.0165C34.3239 24.2346 36.3274 25.3992 37.7417 26.1008C39.2717 26.8004 39.861 27.2675 39.7431 27.9671C39.7431 29.0165 38.5646 29.4836 37.3881 29.4836C35.9739 29.4836 34.5596 29.1338 33.2653 28.5494L32.5582 31.8169C33.9724 32.3992 35.5025 32.6338 36.9167 32.6338C41.2752 32.749 43.9838 30.6502 43.9838 27.5C43.9838 23.5329 38.4467 23.3004 38.4467 21.5514ZM58 32.5165L54.82 17.3498H51.4044C50.6972 17.3498 49.9901 17.8169 49.7544 18.5165L43.8659 32.5165H47.9887L48.8116 30.3004H53.8772L54.3486 32.5165H58ZM51.9936 21.4342L53.1701 27.1502H49.8723L51.9936 21.4342Z" fill="#172B85"/>
                        </svg>
                      )}
                      {cardBrand === 'mastercard' && (
                        <svg viewBox="0 -9 58 58" xmlns="http://www.w3.org/2000/svg" className={styles.cardIcon}>
                          <rect x="0.5" y="0.5" width="57" height="39" rx="3.5" fill="white" stroke="#F3F3F3"/>
                          <path fillRule="evenodd" clipRule="evenodd" d="M21.2489 30.8906V32.3674V33.8443H20.6016V33.4857C20.3963 33.7517 20.0848 33.9186 19.6614 33.9186C18.8266 33.9186 18.1722 33.27 18.1722 32.3674C18.1722 31.4656 18.8266 30.8163 19.6614 30.8163C20.0848 30.8163 20.3963 30.9832 20.6016 31.2492V30.8906H21.2489ZM19.7419 31.4218C19.1816 31.4218 18.8387 31.8483 18.8387 32.3674C18.8387 32.8866 19.1816 33.3131 19.7419 33.3131C20.2773 33.3131 20.6387 32.905 20.6387 32.3674C20.6387 31.8299 20.2773 31.4218 19.7419 31.4218ZM43.1228 32.3674C43.1228 31.8483 43.4657 31.4218 44.026 31.4218C44.5621 31.4218 44.9228 31.8299 44.9228 32.3674C44.9228 32.905 44.5621 33.3131 44.026 33.3131C43.4657 33.3131 43.1228 32.8866 43.1228 32.3674ZM45.5338 29.7044V32.3674V33.8443H44.8858V33.4857C44.6804 33.7517 44.3689 33.9186 43.9455 33.9186C43.1107 33.9186 42.4563 33.27 42.4563 32.3674C42.4563 31.4656 43.1107 30.8163 43.9455 30.8163C44.3689 30.8163 44.6804 30.9832 44.8858 31.2492V29.7044H45.5338ZM29.2838 31.3914C29.7008 31.3914 29.9688 31.6509 30.0373 32.1079H28.4925C28.5616 31.6814 28.8225 31.3914 29.2838 31.3914ZM27.8138 32.3674C27.8138 31.4465 28.424 30.8163 29.2966 30.8163C30.1307 30.8163 30.7038 31.4465 30.7102 32.3674C30.7102 32.4537 30.7038 32.5344 30.6974 32.6143H28.4868C28.5802 33.1462 28.9601 33.3379 29.3771 33.3379C29.6758 33.3379 29.9938 33.2261 30.2433 33.0288L30.5605 33.5048C30.1991 33.8075 29.7885 33.9186 29.3401 33.9186C28.449 33.9186 27.8138 33.3068 27.8138 32.3674ZM37.1126 32.3674C37.1126 31.8483 37.4555 31.4218 38.0158 31.4218C38.5511 31.4218 38.9126 31.8299 38.9126 32.3674C38.9126 32.905 38.5511 33.3131 38.0158 33.3131C37.4555 33.3131 37.1126 32.8866 37.1126 32.3674ZM39.5228 30.8906V32.3674V33.8443H38.8755V33.4857C38.6695 33.7517 38.3587 33.9186 37.9352 33.9186C37.1004 33.9186 36.446 33.27 36.446 32.3674C36.446 31.4656 37.1004 30.8163 37.9352 30.8163C38.3587 30.8163 38.6695 30.9832 38.8755 31.2492V30.8906H39.5228ZM33.4569 32.3674C33.4569 33.2636 34.0857 33.9186 35.0452 33.9186C35.4936 33.9186 35.7923 33.8196 36.116 33.5663L35.8051 33.0472C35.5621 33.2205 35.3068 33.3131 35.026 33.3131C34.5091 33.3068 34.1292 32.9361 34.1292 32.3674C34.1292 31.7988 34.5091 31.4281 35.026 31.4218C35.3068 31.4218 35.5621 31.5144 35.8051 31.6877L36.116 31.1685C35.7923 30.9153 35.4936 30.8163 35.0452 30.8163C34.0857 30.8163 33.4569 31.4713 33.4569 32.3674ZM41.0177 31.2492C41.1859 30.9896 41.429 30.8163 41.8026 30.8163C41.9337 30.8163 42.1205 30.8411 42.2638 30.8969L42.0642 31.5024C41.9273 31.4465 41.7904 31.4281 41.6593 31.4281C41.2358 31.4281 41.0241 31.6997 41.0241 32.1885V33.8443H40.3761V30.8906H41.0177V31.2492ZM24.4505 31.1254C24.1389 30.9217 23.7098 30.8163 23.2364 30.8163C22.4822 30.8163 21.9967 31.1749 21.9967 31.762C21.9967 32.2437 22.3582 32.5407 23.024 32.6334L23.3298 32.6765C23.6848 32.7261 23.8524 32.8187 23.8524 32.9856C23.8524 33.2141 23.6157 33.3442 23.1737 33.3442C22.7253 33.3442 22.4017 33.2021 22.1835 33.0351L21.8784 33.5352C22.2334 33.7948 22.6818 33.9186 23.1673 33.9186C24.027 33.9186 24.5253 33.5168 24.5253 32.9545C24.5253 32.4353 24.1332 32.1637 23.4852 32.0711L23.1801 32.0272C22.9 31.9904 22.6754 31.9353 22.6754 31.7372C22.6754 31.5208 22.8871 31.3914 23.2421 31.3914C23.6221 31.3914 23.9899 31.5335 24.1703 31.6446L24.4505 31.1254ZM32.0184 31.2492C32.1859 30.9896 32.429 30.8163 32.8025 30.8163C32.9337 30.8163 33.1205 30.8411 33.2637 30.8969L33.0641 31.5024C32.9273 31.4465 32.7904 31.4281 32.6592 31.4281C32.2358 31.4281 32.0241 31.6997 32.0241 32.1885V33.8443H31.3768V30.8906H32.0184V31.2492ZM27.2784 30.8906H26.2198V29.9944H25.5654V30.8906H24.9616V31.4776H25.5654V32.8251C25.5654 33.5105 25.8334 33.9186 26.5991 33.9186C26.8799 33.9186 27.2036 33.8323 27.4089 33.6901L27.2221 33.1398C27.0289 33.2509 26.8172 33.3068 26.649 33.3068C26.3253 33.3068 26.2198 33.1087 26.2198 32.8123V31.4776H27.2784V30.8906ZM17.5997 31.9904V33.8443H16.9453V32.2005C16.9453 31.6997 16.7336 31.4218 16.2916 31.4218C15.8617 31.4218 15.563 31.6941 15.563 32.2069V33.8443H14.9086V32.2005C14.9086 31.6997 14.6912 31.4218 14.2613 31.4218C13.8186 31.4218 13.5321 31.6941 13.5321 32.2069V33.8443H12.8784V30.8906H13.5264V31.2548C13.7695 30.909 14.0803 30.8163 14.3982 30.8163C14.853 30.8163 15.1767 31.0144 15.382 31.3418C15.6564 30.9274 16.0485 30.8099 16.4285 30.8163C17.1513 30.8227 17.5997 31.2923 17.5997 31.9904Z" fill="#231F20"/>
                          <path d="M34.0465 25.8715H24.2359V8.3783H34.0465V25.8715Z" fill="#FF5F00"/>
                          <path d="M24.8583 17.1253C24.8583 13.5767 26.5328 10.4157 29.1405 8.37867C27.2336 6.88907 24.8269 5.99998 22.2114 5.99998C16.0194 5.99998 11 10.9809 11 17.1253C11 23.2697 16.0194 28.2506 22.2114 28.2506C24.8269 28.2506 27.2336 27.3615 29.1405 25.8719C26.5328 23.8349 24.8583 20.6739 24.8583 17.1253" fill="#EB001B"/>
                          <path d="M47.2818 17.1253C47.2818 23.2697 42.2624 28.2506 36.0704 28.2506C33.4548 28.2506 31.0482 27.3615 29.1405 25.8719C31.7489 23.8349 33.4235 20.6739 33.4235 17.1253C33.4235 13.5767 31.7489 10.4157 29.1405 8.37867C31.0482 6.88907 33.4548 5.99998 36.0704 5.99998C42.2624 5.99998 47.2818 10.9809 47.2818 17.1253" fill="#F79E1B"/>
                        </svg>
                      )}
                      {!cardBrand && (
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={styles.cardIcon}>
                          <path fillRule="evenodd" clipRule="evenodd" d="M20 4C21.6569 4 23 5.34315 23 7V17C23 18.6569 21.6569 20 20 20H4C2.34315 20 1 18.6569 1 17V7C1 5.34315 2.34315 4 4 4H20ZM20 6C20.5523 6 21 6.44772 21 7V9H3V7C3 6.44771 3.44772 6 4 6H20ZM3 11V17C3 17.5523 3.44772 18 4 18H20C20.5523 18 21 17.5523 21 17V11H3Z" fill="#0F0F0F"/>
                        </svg>
                      )}
                    </span>
                    <div className={styles.rowText}>
                      <div className={styles.rowTitle}>{cardBrand === 'mastercard' ? 'Mastercard' : cardBrand === 'visa' ? 'Visa' : 'Carte enregistrée'} …{last4}</div>
                      <div className={styles.rowSub}>Carte par défaut</div>
                    </div>
                    <button
                      type="button"
                      className={styles.cardDeleteBtn}
                      onClick={(e)=>{
                        e.stopPropagation()
                        setHasCard(false)
                        setLast4('')
                        setCardBrand(null)
                      }}
                      aria-label="Supprimer cette carte"
                    >
                      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={styles.cardDeleteIcon}>
                        <path d="M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6M18 6V16.2C18 17.8802 18 18.7202 17.673 19.362C17.3854 19.9265 16.9265 20.3854 16.362 20.673C15.7202 21 14.8802 21 13.2 21H10.8C9.11984 21 8.27976 21 7.63803 20.673C7.07354 20.3854 6.6146 19.9265 6.32698 19.362C6 18.7202 6 17.8802 6 16.2V6M14 10V17M10 10V17" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              {paymentMode === 'now' && (
                <div className={styles.paymentNewRow}>
                  <div className={styles.paymentNewLabel}>Ajouter un mode de paiement</div>
                  <button type="button" className={styles.paymentMethodBtn} onClick={() => setShowCardModal(true)}>
                    <span className={styles.paymentMethodIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={styles.cardIcon}>
                        <path fillRule="evenodd" clipRule="evenodd" d="M20 4C21.6569 4 23 5.34315 23 7V17C23 18.6569 21.6569 20 20 20H4C2.34315 20 1 18.6569 1 17V7C1 5.34315 2.34315 4 4 4H20ZM20 6C20.5523 6 21 6.44772 21 7V9H3V7C3 6.44771 3.44772 6 4 6H20ZM3 11V17C3 17.5523 3.44772 18 4 18H20C20.5523 18 21 17.5523 21 17V11H3Z" fill="#0F0F0F"/>
                      </svg>
                    </span>
                    <span>Carte de crédit / débit</span>
                    <span className={styles.paymentMethodArrow}>›</span>
                  </button>
                  {(!hasCard && paymentError) && (
                    <div className={styles.errorText} style={{marginTop:8}}>{paymentError}</div>
                  )}
                </div>
              )}
              {paymentMode === 'cod' && (
                <div className={styles.rowItem}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowText}>
                      <div className={styles.rowTitle}>{service === 'pickup' ? 'Paiement sur place' : 'Paiement à la livraison'}</div>
                      <div className={styles.radioGroup} style={{marginTop:6}}>
                        <label className={styles.radioLine}>
                          <input type="radio" name="codMethod" checked={codMethod==='cash'} onChange={()=>setCodMethod('cash')} />
                          Espèces
                        </label>
                        <label className={styles.radioLine}>
                          <input type="radio" name="codMethod" checked={codMethod==='card'} onChange={()=>setCodMethod('card')} />
                          Carte crédit / débit
                        </label>
                      </div>
                      {/* Removed "Monnaie pour" input per request */}
                    </div>
                  </div>
                </div>
              )}
              <div className={styles.sectionFooter}>
                <button
                  type="button"
                  className={styles.nextBtn}
                  disabled={paymentMode==='now' && !hasCard}
                  onClick={() => {
                    if (paymentMode==='now' && !hasCard) {
                      setPaymentError('Ajoutez une carte pour payer maintenant.')
                      return
                    }
                    requestOpenSection(idxSummary)
                  }}
                >
                  Suivant
                </button>
              </div>
            </>
          )}
        </section>

        {/* Order summary and actions */}
        {lines.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader} onClick={() => requestOpenSection(idxSummary)} role="button" tabIndex={0}>
              <div className={styles.sectionTitle}><span className={styles.sectionIndex}>{service === 'pickup' ? '3' : '4'}</span> Votre commande</div>
            </div>
            {openSection === idxSummary && (
            <>
            <div className={styles.cartList} aria-label="Articles du panier">
              <ul className={styles.cartUl}>
                {lines.map((l, idx) => (
                  <li key={l.key || idx} className={styles.cartItem}>
                    <div className={styles.cartItemMain}>
                      <div className={styles.cartTitle}>{l.item?.title || l.item?.name || `Article #${l.itemId}`}</div>
                      <div className={styles.cartMeta}>
                        <span className={styles.qty}>{l.qty} × {formatPrice(l.unitPrice)}</span>
                        <span className={styles.total}>{formatPrice(l.total)}</span>
                        {editingSlug && (
                          <button type="button" className={styles.editLink} onClick={() => setEditIndex(idx)}>Modifier</button>
                        )}
                      </div>
                    </div>
                    {l.selections && (
                      (() => {
                        const entries = Object.entries(l.selections || {}).filter(([groupId, sel]) => {
                          const labels = l.selectionLabels?.[groupId]
                          if (Array.isArray(labels)) return labels.length > 0
                          if (Array.isArray(sel)) return sel.length > 0
                          return sel != null && sel !== ''
                        })
                        if (entries.length === 0) return null
                        return (
                          <div className={styles.optionsList}>
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
                                <span className={styles.optionVal}>{(() => {
                                  const labels = l.selectionLabels?.[groupId]
                                  if (Array.isArray(labels) && labels.length) return labels.join(', ')
                                  return Array.isArray(sel) ? sel.join(', ') : String(sel)
                                })()}</span>
                              </div>
                            ))}
                          </div>
                        )
                      })()
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {service !== 'pickup' && (
              <div className={`${styles.tipBlock} ${styles.tipBlockSummary}`}>
                <div className={styles.tipHeader}>Pourboire</div>
                <div className={styles.tipRow}>
                  {[0.15, 0.18, 0.20, 0.25].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`${styles.tipBtn} ${tipPreset === p && tipCustom === '' ? styles.tipActive : ''}`}
                      onClick={() => { setTipPreset(p); setTipCustom('') }}
                    >
                      {Math.round(p * 100)}%
                    </button>
                  ))}
                  <input
                    className={styles.tipCustom}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Montant personnalisé"
                    value={tipCustom}
                    onChange={(e) => setTipCustom(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className={styles.summary}>
              <div className={styles.sumRow}><span>Sous-total</span><span>{formatPrice(subtotal)}</span></div>
              <div className={styles.sumRow}><span>Frais de livraison</span><span>{formatPrice(deliveryFee)}</span></div>
              <div className={styles.sumRow}><span>Taxes</span><span>{formatPrice(taxes)}</span></div>
              {service !== 'pickup' && (
                <div className={styles.sumRow}><span>Pourboire</span><span>{formatPrice(tip)}</span></div>
              )}
              <div className={styles.sumRowTotal}><span>Total</span><strong>{formatPrice(total)}</strong></div>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={() => router.back()}>Retour au menu</button>
              <button
                type="button"
                className={styles.primary}
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder}
                aria-busy={isPlacingOrder ? 'true' : 'false'}
              >
                {isPlacingOrder ? 'Envoi…' : 'Passer la commande'}
              </button>
            </div>
            {orderError && <div className={styles.errorText} role="alert" style={{ marginTop: 12 }}>{orderError}</div>}
            </>
            )}
          </section>
        )}
        </div>
        <aside className={styles.right}>
          <CheckoutMap polygons={deliveryPolygons} />
        </aside>
      </main>
      {showAddressModal && (
        <div className={styles.deliveryBackdrop} onClick={handleCloseAddressModal}>
          <div className={styles.deliveryModal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.modalClose} aria-label="Fermer" onClick={handleCloseAddressModal}>×</button>
            <div className={styles.deliveryHeader}>Modifier l'adresse</div>
            <form className={styles.deliveryForm} onSubmit={(e) => {
              e.preventDefault()
              const chosenLabel = addressDraft
              const lat = addressLat
              const lng = addressLng
              const hasSuggestions = Array.isArray(addrResults) && addrResults.length > 0

              if (hasSuggestions && (lat == null || lng == null)) {
                setAddrSelectionError('Veuillez sélectionner une adresse parmi les suggestions.')
                setAddrOpen(true)
                return
              }

              setAddress(chosenLabel)
              setAddressDraft(chosenLabel)
              setAddrSelectionError('')
              if (lat != null && lng != null) {
                setWithinArea(pointInPolygons(lat, lng, deliveryPolygons))
              } else {
                setWithinArea(null)
              }
              handleCloseAddressModal(chosenLabel)
            }}>
              <div className={styles.deliveryField} style={{ position:'relative' }}>
                <label>Adresse</label>
                <input
                  type="text"
                  autoComplete="street-address"
                  value={addressDraft}
                  onFocus={() => setAddrOpen(true)}
                  onBlur={() => setTimeout(() => setAddrOpen(false), 150)}
                  onChange={(e) => {
                    setAddressDraft(e.target.value)
                    setAddrOpen(true)
                    setAddressLat(null)
                    setAddressLng(null)
                    setAddrSelectionError('')
                  }}
                  placeholder="Numéro et rue, ville"
                />
                {(addrOpen && (addrLoading || addrResults.length > 0)) && (
                  <div className={styles.acWrap}>
                    {addrLoading && <div className={styles.acItem}>Recherche…</div>}
                    {!addrLoading && addrResults.map((r, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={styles.acItem}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setAddressDraft(r.label)
                          setAddressLat(r.lat)
                          setAddressLng(r.lng)
                          setAddrOpen(false)
                          setAddrSelectionError('')
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                    {!addrLoading && addrResults.length === 0 && addressDraft.trim().length >= 3 && (
                      <div className={styles.acItemMuted}>Aucun résultat</div>
                    )}
                  </div>
                )}
                {addrSelectionError && <div className={styles.fieldError}>{addrSelectionError}</div>}
              </div>
              <div className={styles.deliveryActions}>
                <button type="button" className={styles.cancelBtn} onClick={handleCloseAddressModal}>Annuler</button>
                <button type="submit" className={styles.saveBtn}>Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showCardModal && (
        <div className={styles.deliveryBackdrop} onClick={() => setShowCardModal(false)}>
          <div className={styles.deliveryModal} role="dialog" aria-modal="true" onClick={(e)=>e.stopPropagation()}>
            <div className={styles.deliveryHeader}>Ajouter une carte</div>
            <form
              className={styles.deliveryForm}
              onSubmit={(e)=>{
                e.preventDefault()
                const numberInput = e.target.elements.cardNumber
                const cvcInput = e.target.elements.cvc
                const expInput = e.target.elements.exp
                const zipInput = e.target.elements.zip

                const number = (numberInput.value || '').replace(/\s+/g,'')
                const cvc = (cvcInput.value || '').trim()
                const exp = (expInput.value || '').trim()
                const zip = (zipInput.value || '').trim()

                const newErrors = { number: '', cvc: '', exp: '', zip: '' }

                if (number.length < 13 || number.length > 19 || !/^\d+$/.test(number)) {
                  newErrors.number = 'Numéro de carte invalide.'
                }
                if (!/^\d{3,4}$/.test(cvc)) {
                  newErrors.cvc = 'CVC invalide.'
                }
                if (!/^\d{2}\s*\/\s*\d{2}$/.test(exp)) {
                  newErrors.exp = "Date d'expiration invalide. Utilisez le format MM / AA."
                }
                if (!zip) {
                  newErrors.zip = 'Code postal requis.'
                }

                if (newErrors.number || newErrors.cvc || newErrors.exp || newErrors.zip) {
                  setCardErrors(newErrors)
                  return
                }

                const brand = number.startsWith('4') ? 'visa' : (number.match(/^(5[1-5]|2[2-7])/)?'mastercard':null)
                setCardBrand(brand)
                setLast4(number.slice(-4))
                setHasCard(true)
                setCardErrors({ number: '', cvc: '', exp: '', zip: '' })
                setPaymentError('')
                setShowCardModal(false)
              }}
            >
              <div className={styles.row2}>
                <div className={styles.deliveryField}>
                  <label>Numéro de carte</label>
                  <input
                    type="text"
                    name="cardNumber"
                    placeholder="XXXX XXXX XXXX XXXX"
                    inputMode="numeric"
                    autoComplete="cc-number"
                  />
                  {cardErrors.number && (
                    <div className={styles.fieldError}>{cardErrors.number}</div>
                  )}
                </div>
                <div className={styles.deliveryField}>
                  <label>CVC</label>
                  <input
                    type="text"
                    name="cvc"
                    placeholder="CVC"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                  />
                  {cardErrors.cvc && (
                    <div className={styles.fieldError}>{cardErrors.cvc}</div>
                  )}
                </div>
              </div>
              <div className={styles.row2}>
                <div className={styles.deliveryField}>
                  <label>Date d'expiration</label>
                  <input
                    type="text"
                    name="exp"
                    placeholder="MM / AA"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                  />
                  {cardErrors.exp && (
                    <div className={styles.fieldError}>{cardErrors.exp}</div>
                  )}
                </div>
                <div className={styles.deliveryField}>
                  <label>Code postal</label>
                  <input
                    type="text"
                    name="zip"
                    placeholder="Code postal"
                    autoComplete="postal-code"
                  />
                  {cardErrors.zip && (
                    <div className={styles.fieldError}>{cardErrors.zip}</div>
                  )}
                </div>
              </div>
              <div className={styles.deliveryActions}>
                <button type="button" className={styles.cancelBtn} onClick={()=>setShowCardModal(false)}>Retour</button>
                <button type="submit" className={styles.saveBtn}>Ajouter la carte</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showScheduleModal && (
        <div className={styles.deliveryBackdrop} onClick={() => setShowScheduleModal(false)}>
          <div className={styles.scheduleModal} role="dialog" aria-modal="true" onClick={(e)=>e.stopPropagation()}>
            <div className={styles.scheduleHeader}>Planifier votre commande</div>
            <div className={styles.scheduleSub}>Choisissez une fenêtre disponible pour votre commande</div>
            <div className={styles.dayTabs}>
              {remainingWeekDays.map((d,i)=>(
                <button
                  key={i}
                  type="button"
                  className={`${styles.dayTab} ${i===scheduleDayIndex?styles.dayTabActive:''}`}
                  onClick={()=>{ setScheduleDayIndex(i); setScheduleSlot(null) }}
                >
                  <div className={styles.dayTabName}>{i===0?'Aujourd\'hui': (i===1?'Demain':dayNames[d.getDay()])}</div>
                  <div className={styles.dayTabDate}>{d.toLocaleDateString('fr-CA',{ month:'short', day:'numeric'})}</div>
                </button>
              ))}
            </div>
            <div className={styles.slotList}>
              {currentSlots.length === 0 && <div className={styles.slotEmpty}>Aucun créneau disponible</div>}
              {currentSlots.map((slot, idx)=>(
                <label key={idx} className={styles.slotItem}>
                  <input
                    type="radio"
                    name="scheduleSlot"
                    checked={scheduleSlot ? scheduleSlot.start.getTime()===slot.start.getTime() : false}
                    onChange={()=>setScheduleSlot(slot)}
                  />
                  <span>{slotLabel(slot)}</span>
                </label>
              ))}
            </div>
            <div className={styles.deliveryActions}>
              <button type="button" className={styles.cancelBtn} onClick={()=>{ setShowScheduleModal(false); if(!scheduleSlot) { setDeliveryMode('standard') } }}>Annuler</button>
              <button
                type="button"
                className={styles.saveBtn}
                disabled={!scheduleSlot}
                onClick={()=>{ if(scheduleSlot){ setShowScheduleModal(false) } }}
              >Confirmer</button>
            </div>
          </div>
        </div>
      )}
      {showDeliveryModal && (
        <div className={styles.deliveryBackdrop} onClick={() => setShowDeliveryModal(false)}>
          <div className={styles.deliveryModal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className={styles.deliveryHeader}>Instructions de dépôt</div>
            <form className={styles.deliveryForm} onSubmit={(e) => { e.preventDefault(); setShowDeliveryModal(false) }}>
              <div className={styles.deliveryField}>
                <label>Numéro d'appartement ou suite</label>
                <input type="text" value={apartmentSuite} onChange={(e) => setApartmentSuite(e.target.value)} placeholder="Ex.: Apt 305" />
              </div>
              <div className={styles.deliveryField}>
                <label>Options de dépôt</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLine}>
                    <input type="radio" name="dropOption" checked={dropOption==='hand'} onChange={() => setDropOption('hand')} />
                    <span>Remettre en main propre</span>
                  </label>
                  <label className={styles.radioLine}>
                    <input type="radio" name="dropOption" checked={dropOption==='door'} onChange={() => setDropOption('door')} />
                    <span>Laisser à la porte</span>
                  </label>
                </div>
              </div>
              <div className={styles.deliveryField}>
                <label>Détails supplémentaires</label>
                <textarea rows="3" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Ex.: Sonner après la livraison, laisser près du porche, appeler à l'arrivée…" />
              </div>
              <div className={styles.deliveryActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowDeliveryModal(false)}>Annuler</button>
                <button type="submit" className={styles.saveBtn}>Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editIndex != null && lines[editIndex] && editingSlug && (
        <ItemModal
          item={lines[editIndex].item}
          slug={editingSlug}
          defaultSelections={lines[editIndex].selections}
          defaultQty={lines[editIndex].qty}
          confirmLabel="Mettre à jour"
          allowZeroQty
          onClose={() => setEditIndex(null)}
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
    </div>
  )
}

const DAY_INDEX_MAP = {
  dimanche: 0,
  sunday: 0,
  lundi: 1,
  monday: 1,
  mardi: 2,
  tuesday: 2,
  mercredi: 3,
  wednesday: 3,
  jeudi: 4,
  thursday: 4,
  vendredi: 5,
  friday: 5,
  samedi: 6,
  saturday: 6,
}

function normalizeOperatingWindows(hoursJson) {
  const parsed = parseJsonField(hoursJson)
  if (!parsed || typeof parsed !== 'object') return {}
  const windows = {}

  const assign = (key, value) => {
    const index = dayKeyToIndex(key)
    if (index == null) return
    const segments = normalizeSegments(value)
    if (segments.length > 0) {
      windows[index] = segments
    }
  }

  if (Array.isArray(parsed)) {
    parsed.forEach((entry) => {
      if (!entry) return
      const key = entry.day ?? entry.name ?? entry.key
      if (entry.slots) {
        assign(key, entry.slots)
      } else if (entry.value) {
        assign(key, entry.value)
      } else {
        assign(key, entry)
      }
    })
  } else {
    Object.entries(parsed).forEach(([key, value]) => assign(key, value))
  }

  return windows
}

function dayKeyToIndex(key) {
  if (key == null) return null
  const normalized = String(key).trim().toLowerCase()
  if (!normalized) return null
  return Object.prototype.hasOwnProperty.call(DAY_INDEX_MAP, normalized) ? DAY_INDEX_MAP[normalized] : null
}

function normalizeSegments(value) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.flatMap((segment) => normalizeSegments(segment)).filter(Boolean)
  }
  if (typeof value === 'string') {
    const parts = value.split(/-|–|—|à|to/i).map((part) => part && part.trim()).filter(Boolean)
    if (parts.length < 2) return []
    const open = normalizeClock(parts[0])
    const close = normalizeClock(parts[1])
    return open && close ? [{ open, close }] : []
  }
  if (typeof value === 'object') {
    if (value.closed === true || value.isClosed === true) return []
    if (Array.isArray(value.slots)) return normalizeSegments(value.slots)
    const open = normalizeClock(value.open ?? value.start ?? value.from)
    const close = normalizeClock(value.close ?? value.end ?? value.to)
    return open && close ? [{ open, close }] : []
  }
  return []
}

function parseJsonField(input) {
  if (!input) return null
  if (typeof input === 'string') {
    try {
      return JSON.parse(input)
    } catch {
      return null
    }
  }
  if (typeof input === 'object') return input
  return null
}

function normalizeClock(value) {
  if (value == null) return null
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
  }
  if (typeof value === 'number') {
    const hour = Math.floor(value)
    const minute = Math.round((value - hour) * 60)
    return `${String(clamp(hour, 0, 23)).padStart(2, '0')}:${String(clamp(minute, 0, 59)).padStart(2, '0')}`
  }
  const str = String(value).trim()
  if (!str) return null
  const colonMatch = str.match(/(\d{1,2})\s*[:hH]\s*(\d{0,2})/)
  if (colonMatch) {
    const hour = clamp(Number(colonMatch[1]), 0, 23)
    const minute = clamp(colonMatch[2] ? Number(colonMatch[2]) : 0, 0, 59)
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }
  const digits = str.replace(/\D/g, '')
  if (!digits) return null
  let hourDigits
  let minuteDigits
  if (digits.length <= 2) {
    hourDigits = digits
    minuteDigits = '00'
  } else {
    hourDigits = digits.slice(0, -2)
    minuteDigits = digits.slice(-2)
  }
  const hour = clamp(Number(hourDigits), 0, 23)
  const minute = clamp(Number(minuteDigits), 0, 59)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

function buildSlotsForDate(date, windowsMap) {
  if (!(date instanceof Date)) return []
  if (!windowsMap) return []
  const segments = windowsMap[date.getDay()]
  if (!Array.isArray(segments) || segments.length === 0) return []
  const windowMinutes = 20
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const slots = []

  segments.forEach(({ open, close }) => {
    if (!open || !close) return
    const [openH, openM = '0'] = open.split(':').map(Number)
    const [closeH, closeM = '0'] = close.split(':').map(Number)
    if (Number.isNaN(openH) || Number.isNaN(closeH)) return
    let segmentStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), openH, Number.isNaN(openM) ? 0 : openM)
    let segmentEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), closeH, Number.isNaN(closeM) ? 0 : closeM)
    if (segmentEnd <= segmentStart) {
      segmentEnd = new Date(segmentEnd.getTime() + 24 * 60 * 60 * 1000)
    }

    let cursor = segmentStart
    while (cursor < segmentEnd) {
      const slotEnd = new Date(cursor.getTime() + windowMinutes * 60000)
      if (slotEnd > segmentEnd) break
      if (isToday && slotEnd <= now) {
        cursor = slotEnd
        continue
      }
      slots.push({ start: new Date(cursor), end: slotEnd })
      cursor = slotEnd
    }
  })

  return slots
}

function normalizeServiceTypes(rawValue) {
  const fallback = ['delivery', 'pickup']
  if (rawValue == null) return fallback

  let parsed = rawValue
  if (typeof rawValue === 'string') {
    try {
      parsed = JSON.parse(rawValue)
    } catch {
      parsed = rawValue
    }
  }

  if (!Array.isArray(parsed)) parsed = [parsed]

  const normalized = parsed
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : null))
    .filter((entry) => entry === 'delivery' || entry === 'pickup')

  const unique = Array.from(new Set(normalized))
  return unique.length > 0 ? unique : fallback
}
