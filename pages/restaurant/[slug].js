import { useRouter } from 'next/router'
import { useEffect, useMemo, useState, useRef } from 'react'
import Header from '../../components/Header'
import RestaurantInfo from '../../components/RestaurantInfo'
import ItemCard from '../../components/ItemCard'
import ItemModal from '../../components/ItemModal'
import { useCart } from '../../context/CartContext'
import pageStyles from '../../styles/RestaurantPage.module.css'
import { extractPolygonsFromGeoJson } from '../../data/deliveryArea'

function formatSlug(slug) {
  if (!slug) return ''
  return slug
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
}

export default function RestaurantPage() {
  const router = useRouter()
  const { slug } = router.query
  const restaurantName = slug === 'sante-taouk' ? 'Santé Taouk' : (slug ? formatSlug(slug) : 'Restaurant')
  const headerTitle = 'Préparez votre commande'
  const { addItem } = useCart()

  const [menuData, setMenuData] = useState(null)
  const [flatItems, setFlatItems] = useState([])
  const [activeCatId, setActiveCatId] = useState(null)
  const [modalItem, setModalItem] = useState(null)
  const navListRef = useRef(null)
  const highlightRef = useRef(null)
  const [loadError, setLoadError] = useState('')
  const [configErrors, setConfigErrors] = useState([])

  const resolvedRestaurantName = menuData?.restaurant?.name ?? restaurantName
  const resolvedSchedule = useMemo(() => normalizeWeeklyHours(menuData?.settings?.hours_json), [menuData?.settings?.hours_json])
  const resolvedAddress = buildAddressFromSettings(menuData?.settings) || 'Adresse non disponible'
  const availableServices = useMemo(
    () => normalizeServiceTypes(menuData?.settings?.service_types),
    [menuData?.settings?.service_types]
  )
  const defaultService = useMemo(() => {
    if (availableServices.includes('delivery')) return 'delivery'
    return availableServices[0] || 'delivery'
  }, [availableServices])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    async function loadMenu() {
      try {
        setLoadError('')
        const res = await fetch(`/api/restaurant/${slug}/menu`)
        if (!res.ok) throw new Error('HTTP non OK')
        const payload = await res.json()
        const polygonsFromPayload = extractPolygonsFromGeoJson(payload?.settings?.delivery_zones_geojson)
        if (cancelled) return
        setMenuData(payload)
        const settingsWarnings = []
        if (!payload.settings) {
          settingsWarnings.push('Paramètres du restaurant introuvables.')
        } else {
          if (!payload.settings.hours_json) settingsWarnings.push('Les horaires ne sont pas configurés dans Supabase.')
          if (!payload.settings.delivery_zones_geojson) settingsWarnings.push('Les zones de livraison sont absentes dans Supabase.')
        }
        if (!Array.isArray(payload.categories) || payload.categories.length === 0) {
          settingsWarnings.push('Aucune catégorie active trouvée pour ce restaurant.')
        }
        setConfigErrors(settingsWarnings)
        const flattened = (payload.categories || []).flatMap((cat) =>
          (cat.items || []).map((item) => ({ ...item, category_id: cat.id }))
        )
        setFlatItems(flattened)
        setActiveCatId((payload.categories || [])[0]?.id || null)
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('lastRestaurantSlug', String(slug))
            if (payload.settings) {
              localStorage.setItem('lastRestaurantSettings', JSON.stringify(payload.settings))
            }
            if (polygonsFromPayload.length > 0) {
              localStorage.setItem('lastDeliveryPolygons', JSON.stringify(polygonsFromPayload))
            } else {
              localStorage.removeItem('lastDeliveryPolygons')
            }
          }
        } catch {}
      } catch (error) {
        console.error('Menu fetch failed.', error)
        if (cancelled) return
        setMenuData(null)
        setFlatItems([])
        setActiveCatId(null)
        setConfigErrors([])
        setLoadError('Impossible de charger les données du restaurant. Veuillez réessayer plus tard.')
      }
    }
    loadMenu()
    return () => { cancelled = true }
  }, [slug])

  const sections = (menuData?.categories || []).filter((section) => (section.items || []).length > 0)

  // Scroll spy: compute active section by header position, but only when the section
  // title is close to the top rather than anywhere in the middle of the viewport.
  useEffect(() => {
    if (sections.length === 0) return
    if (typeof window === 'undefined') return

    const headerOffset = 120 // should match CSS scroll-margin-top intent
    const activationRadius = 40 // px distance from headerOffset within which a section becomes "active"

    const updateActive = () => {
      const doc = document.documentElement
      const nearBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 2
      if (nearBottom) {
        const last = sections[sections.length - 1]
        if (last && last.id !== activeCatId) setActiveCatId(last.id)
        return
      }

      let bestId = activeCatId || null
      let bestDistance = Infinity

      for (const s of sections) {
        const el = document.getElementById(`cat-${s.id}`)
        if (!el) continue
        const top = el.getBoundingClientRect().top
        const distance = Math.abs(top - headerOffset)
        // Only consider this section if its title is close to the desired offset
        if (distance <= activationRadius && distance < bestDistance) {
          bestDistance = distance
          bestId = s.id
        }
      }

      if (bestId == null && sections[0]) bestId = sections[0].id
      if (bestId && bestId !== activeCatId) setActiveCatId(bestId)
    }

    updateActive()
    window.addEventListener('scroll', updateActive, { passive: true })
    window.addEventListener('resize', updateActive)
    return () => {
      window.removeEventListener('scroll', updateActive)
      window.removeEventListener('resize', updateActive)
    }
  }, [slug, sections.length, activeCatId])

  // Move the green highlighter to the active link
  useEffect(() => {
    const nav = navListRef.current
    const hl = highlightRef.current
    if (!nav || !hl || !activeCatId) return
    const link = nav.querySelector(`a[data-cat-id="${activeCatId}"]`)
    if (!link) return
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640
    if (isMobile) {
      // Move underline under the active tab
      const left = link.offsetLeft
      const width = link.offsetWidth
      hl.style.transform = `translateX(${left}px)`
      hl.style.width = `${width}px`
      hl.style.height = '3px'

      // Auto-scroll the horizontal list so the active tab stays in view / roughly centered
      const navWidth = nav.clientWidth
      const linkWidth = link.offsetWidth
      const targetScrollLeft = Math.max(
        0,
        link.offsetLeft - (navWidth - linkWidth) / 2
      )
      nav.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth',
      })
    } else {
      const top = link.offsetTop
      const height = link.offsetHeight
      hl.style.transform = `translateY(${top}px)`
      hl.style.height = `${height}px`
      hl.style.width = 'calc(100% - 16px)'
    }
    // width fills container padding by CSS; avoid per-link width to keep centered
  }, [activeCatId, sections.length])

  return (
    <div>
      <Header name={headerTitle} />

      <RestaurantInfo
        name={resolvedRestaurantName}
        address={resolvedAddress}
        schedule={resolvedSchedule || {}}
        availableServices={availableServices}
        defaultService={defaultService}
      />

      {loadError && (
        <div className={pageStyles.errorNotice} role="alert">
          {loadError}
        </div>
      )}

      {configErrors.length > 0 && !loadError && (
        <div className={pageStyles.errorNotice} role="alert">
          {configErrors.map((msg, idx) => (
            <p key={`${msg}-${idx}`}>{msg}</p>
          ))}
        </div>
      )}

      <main className={pageStyles.pageLayout}>
        {/* Side categories nav */}
        <aside className={pageStyles.sideNav} aria-label="Catégories du menu">
          <div className={pageStyles.sideNavInner}>
            <div className={pageStyles.sideNavList} ref={navListRef}>
              <div className={pageStyles.sideNavHighlighter} ref={highlightRef} aria-hidden="true" />
              {sections.map((cat) => (
                <a
                  key={cat.id}
                  href={`#cat-${cat.id}`}
                  data-cat-id={cat.id}
                  className={`${pageStyles.categoryLink} ${activeCatId === cat.id ? pageStyles.active : ''}`}
                >
                  {cat.name}
                </a>
              ))}
            </div>
          </div>
        </aside>

        {/* Content sections */}
        <div className={pageStyles.pageContent}>
          {sections.length === 0 && !loadError && (
            <section className={pageStyles.itemsGrid}>
              {flatItems.map((item) => (
                <ItemCard key={item.id} item={item} onAdd={(it) => setModalItem(it)} />
              ))}
            </section>
          )}

          {sections.map((cat) => (
            <section key={cat.id} id={`cat-${cat.id}`} className={pageStyles.categorySection}>
              <h2 className={pageStyles.categoryTitle}>{cat.name}</h2>
              <div className={pageStyles.itemsGrid}>
                {cat.items.map((item) => (
                  <ItemCard key={item.id} item={item} onAdd={(it) => setModalItem(it)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {modalItem && (
        <ItemModal
          item={modalItem}
          slug={slug}
          onClose={() => setModalItem(null)}
          onConfirm={(payload) => {
            addItem({ ...payload, item: modalItem })
            setModalItem(null)
          }}
        />
      )}
    </div>
  )
}

function buildAddressFromSettings(settings) {
  if (!settings) return ''
  const parts = [
    settings.address_line1,
    settings.address_line2,
    [settings.city, settings.province].filter(Boolean).join(', '),
    settings.postal_code,
    settings.country,
  ].filter((part) => part && part.trim().length > 0)
  return parts.join(', ').replace(/, ,/g, ',')
}

const WEEK_DAYS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche']
const DAY_KEY_ALIASES = {
  monday: 'lundi',
  tuesday: 'mardi',
  wednesday: 'mercredi',
  thursday: 'jeudi',
  friday: 'vendredi',
  saturday: 'samedi',
  sunday: 'dimanche',
  dimanche: 'dimanche',
  lundi: 'lundi',
  mardi: 'mardi',
  mercredi: 'mercredi',
  jeudi: 'jeudi',
  vendredi: 'vendredi',
  samedi: 'samedi',
}

function normalizeWeeklyHours(hoursJson) {
  const parsed = parseJsonField(hoursJson)
  if (!parsed || typeof parsed !== 'object') return null
  const normalized = {}
  let hasValue = false

  const assignValue = (key, value) => {
    const normalizedKey = normalizeDayKey(key)
    if (!normalizedKey) return
    const label = formatHoursValue(value)
    normalized[normalizedKey] = label
    if (label && label.trim().length > 0) hasValue = true
  }

  if (Array.isArray(parsed)) {
    parsed.forEach((entry) => {
      if (!entry) return
      if (entry.day) {
        assignValue(entry.day, entry.value ?? entry.slots ?? entry)
      }
    })
  } else {
    Object.entries(parsed).forEach(([key, value]) => assignValue(key, value))
  }

  return hasValue ? normalized : null
}

function normalizeDayKey(key) {
  if (!key) return null
  const lowered = String(key).trim().toLowerCase()
  if (!lowered) return null
  if (WEEK_DAYS.includes(lowered)) return lowered
  return DAY_KEY_ALIASES[lowered] || null
}

function parseJsonField(value) {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  if (typeof value === 'object') return value
  return null
}

function formatHoursValue(raw) {
  if (!raw) return 'Fermé'
  if (typeof raw === 'string') return raw
  const segments = Array.isArray(raw) ? raw : [raw]
  const labels = segments
    .map((segment) => {
      if (!segment) return null
      if (typeof segment === 'string') return segment
      if (segment.label) return segment.label
      if (segment.open && segment.close) return `${formatClock(segment.open)}–${formatClock(segment.close)}`
      return null
    })
    .filter(Boolean)
  return labels.length > 0 ? labels.join(', ') : 'Fermé'
}

function formatClock(value) {
  if (typeof value !== 'string') return ''
  const [hour = '00', minute = '00'] = value.split(':')
  const safeHour = hour.padStart(2, '0')
  const safeMinute = minute.padStart(2, '0')
  return `${safeHour}h${safeMinute}`
}

function normalizeServiceTypes(rawValue) {
  const allowed = ['delivery', 'pickup']
  if (rawValue == null) return allowed

  let parsed = rawValue
  if (typeof rawValue === 'string') {
    const fromJson = parseJsonField(rawValue)
    parsed = fromJson ?? rawValue
  }

  if (!Array.isArray(parsed)) parsed = [parsed]

  const normalized = parsed
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : null))
    .filter((entry) => allowed.includes(entry))

  const unique = Array.from(new Set(normalized))
  return unique.length > 0 ? unique : allowed
}
