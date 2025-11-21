import { supabaseClient } from '../supabase/client'

function mapBy(array, key) {
  return array.reduce((acc, item) => {
    const k = item[key]
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})
}

export async function fetchRestaurantMenu(slug) {
  const { data: restaurant, error: restaurantError } = await supabaseClient
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (restaurantError) throw restaurantError
  if (!restaurant) return null

  const settingsPromise = supabaseClient
    .from('restaurant_settings')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .maybeSingle()

  const categoriesPromise = supabaseClient
    .from('menu_categories')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const itemsPromise = supabaseClient
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const [{ data: settings, error: settingsError }, { data: categories, error: categoriesError }, { data: items, error: itemsError }] = await Promise.all([
    settingsPromise,
    categoriesPromise,
    itemsPromise,
  ])

  if (settingsError) throw settingsError
  if (categoriesError) throw categoriesError
  if (itemsError) throw itemsError

  const itemIds = (items || []).map((item) => item.id)
  let groups = []
  let options = []
  if (itemIds.length > 0) {
    const { data: groupData, error: groupError } = await supabaseClient
      .from('modifier_groups')
      .select('*')
      .in('menu_item_id', itemIds)
      .order('sort_order', { ascending: true })

    if (groupError) throw groupError
    groups = groupData || []

    const groupIds = groups.map((group) => group.id)
    if (groupIds.length > 0) {
      const { data: optionData, error: optionError } = await supabaseClient
        .from('modifier_options')
        .select('*')
        .in('group_id', groupIds)
        .order('sort_order', { ascending: true })

      if (optionError) throw optionError
      options = optionData || []
    }
  }

  const groupsByItem = mapBy(groups, 'menu_item_id')
  const optionsByGroup = mapBy(options, 'group_id')
  const itemsByCategory = mapBy(items || [], 'category_id')

  const enrichedCategories = (categories || []).map((category) => {
    const catItems = (itemsByCategory[category.id] || []).map((item) => {
      const itemGroups = groupsByItem[item.id] || []
      const enrichedGroups = itemGroups.map((group) => ({
        ...group,
        options: optionsByGroup[group.id] || [],
      }))
      return {
        ...item,
        modifiers: enrichedGroups,
      }
    })

    return {
      ...category,
      items: catItems,
    }
  })

  return {
    restaurant,
    settings,
    categories: enrichedCategories,
  }
}
