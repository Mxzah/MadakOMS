import { useRouter } from 'next/router'
import { useEffect, useState, useRef } from 'react'
import Header from '../../components/Header'
import RestaurantInfo from '../../components/RestaurantInfo'
import ItemCard from '../../components/ItemCard'
import ItemModal from '../../components/ItemModal'
import { useCart } from '../../context/CartContext'
import itemsFallback from '../../data/items-sante-taouk.json'
import menuCategoriesFallback from '../../data/menu_categories.json'
import itemCategoriesFallback from '../../data/item_categories.json'
import pageStyles from '../../styles/RestaurantPage.module.css'

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

  const schedule = {
    lundi: '11h00–20h00',
    mardi: '11h00–20h00',
    mercredi: '11h00–20h00',
    jeudi: '11h00–21h00',
    vendredi: '11h00–21h00',
    samedi: '11h00–20h00',
    dimanche: 'Fermé',
  }
  const address = '1905 105e Ave, Shawinigan-Sud, Quebec G9P 1N5'

  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [itemCategories, setItemCategories] = useState([])
  const [activeCatId, setActiveCatId] = useState(null)
  const [modalItem, setModalItem] = useState(null)
  const navListRef = useRef(null)
  const highlightRef = useRef(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    // Persist slug for checkout page edits
    try { if (typeof window !== 'undefined') localStorage.setItem('lastRestaurantSlug', String(slug)) } catch {}
    async function loadAll() {
      try {
        const [itemsRes, catsRes, mapRes] = await Promise.all([
          fetch(`/api/restaurant/${slug}/items`),
          fetch(`/api/restaurant/${slug}/menu-categories`),
          fetch(`/api/restaurant/${slug}/item-categories`),
        ])

        if (!itemsRes.ok || !catsRes.ok || !mapRes.ok) throw new Error('HTTP non OK')

        const [itemsData, catsData, mapData] = await Promise.all([
          itemsRes.json(),
          catsRes.json(),
          mapRes.json(),
        ])

        if (!cancelled) {
          setItems(Array.isArray(itemsData.items) ? itemsData.items : [])
          setCategories(Array.isArray(catsData.categories) ? catsData.categories : [])
          setItemCategories(Array.isArray(mapData.itemCategories) ? mapData.itemCategories : [])
        }
      } catch (e) {
        if (!cancelled) {
                  // Fallbacks locaux pour la démo
                  if (slug === 'sante-taouk') {
                    setItems(itemsFallback)
                    setCategories(menuCategoriesFallback)
                    setItemCategories(itemCategoriesFallback)
                  } else {
                    setItems([])
                    setCategories([])
                    setItemCategories([])
                  }
        }
      }
    }
    loadAll()
    return () => { cancelled = true }
  }, [slug])

  // Prépare le regroupement: map catégorie -> Set d'item_id
  const categoryToItemIds = new Map()
  for (const ic of itemCategories) {
    if (!categoryToItemIds.has(ic.menu_category_id)) {
      categoryToItemIds.set(ic.menu_category_id, new Set())
    }
    categoryToItemIds.get(ic.menu_category_id).add(ic.item_id)
  }

  // Trie les catégories par sort_order
  const sortedCategories = [...categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  // Construit les sections avec items filtrés
  const sections = sortedCategories.map((cat) => {
    const ids = categoryToItemIds.get(cat.id) || new Set()
    const catItems = items.filter((it) => ids.has(it.id))
    return { ...cat, items: catItems }
  }).filter((s) => s.items.length > 0)

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

      <RestaurantInfo name={restaurantName} address={address} schedule={schedule} defaultService="delivery" />

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
          {sections.length === 0 && (
            <section className={pageStyles.itemsGrid}>
              {items.map((item) => (
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
