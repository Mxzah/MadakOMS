import { useRouter } from 'next/router'
import { useEffect, useState, useRef } from 'react'
import Header from '../../components/Header'
import RestaurantInfo from '../../components/RestaurantInfo'
import ItemCard from '../../components/ItemCard'
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
  const name = slug === 'sante-taouk' ? 'Santé Taouk' : (slug ? formatSlug(slug) : 'Restaurant')

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
  const navListRef = useRef(null)
  const highlightRef = useRef(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
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

  // Scroll spy: compute active section by nearest header offset, with bottom snap
  useEffect(() => {
    if (sections.length === 0) return
    if (typeof window === 'undefined') return

    const headerOffset = 120 // should match CSS scroll-margin-top intent

    const updateActive = () => {
      const doc = document.documentElement
      const nearBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 2
      if (nearBottom) {
        const last = sections[sections.length - 1]
        if (last && last.id !== activeCatId) setActiveCatId(last.id)
        return
      }

      let bestId = null
      let bestTop = -Infinity
      for (const s of sections) {
        const el = document.getElementById(`cat-${s.id}`)
        if (!el) continue
        const top = el.getBoundingClientRect().top
        // prefer the section whose top is just above the header offset (very sensitive)
        if (top <= headerOffset + 8 && top > bestTop) {
          bestTop = top
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
  }, [slug, sections.length])

  // Move the green highlighter to the active link
  useEffect(() => {
    const nav = navListRef.current
    const hl = highlightRef.current
    if (!nav || !hl || !activeCatId) return
    const link = nav.querySelector(`a[data-cat-id="${activeCatId}"]`)
    if (!link) return
    const top = link.offsetTop - nav.scrollTop
    const height = link.offsetHeight
    hl.style.transform = `translateY(${top}px)`
    hl.style.height = `${height}px`
    // width fills container padding by CSS; avoid per-link width to keep centered
  }, [activeCatId, sections.length])

  return (
    <div>
      <Header name={name} cartSubtotal={18.98} cartCount={1} />

      <RestaurantInfo name={name} address={address} schedule={schedule} defaultService="delivery" />

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
                <ItemCard key={item.id} item={item} onAdd={(it) => console.log('Ajouter', it.id)} />
              ))}
            </section>
          )}

          {sections.map((cat) => (
            <section key={cat.id} id={`cat-${cat.id}`} className={pageStyles.categorySection}>
              <h2 className={pageStyles.categoryTitle}>{cat.name}</h2>
              <div className={pageStyles.itemsGrid}>
                {cat.items.map((item) => (
                  <ItemCard key={item.id} item={item} onAdd={(it) => console.log('Ajouter', it.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
