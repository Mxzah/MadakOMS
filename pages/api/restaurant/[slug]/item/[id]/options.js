import { supabaseClient } from '../../../../../../lib/supabase/client'
import { fetchRestaurantBySlug } from '../../../../../../lib/db/restaurants'

export default async function handler(req, res) {
  const { slug, id } = req.query
  try {
    const restaurant = await fetchRestaurantBySlug(slug)
    if (!restaurant) return res.status(404).json({ error: 'Restaurant introuvable' })

    const { data: groups, error: groupError } = await supabaseClient
      .from('modifier_groups')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('menu_item_id', id)
      .order('sort_order', { ascending: true })

    if (groupError) throw groupError

    const groupIds = (groups || []).map((group) => group.id)
    let options = []
    if (groupIds.length > 0) {
      const { data: optionData, error: optionError } = await supabaseClient
        .from('modifier_options')
        .select('*')
        .in('group_id', groupIds)
        .order('sort_order', { ascending: true })

      if (optionError) throw optionError
      options = optionData || []
    }

    const optionsByGroup = options.reduce((acc, option) => {
      const list = acc[option.group_id] || []
      list.push({
        id: option.id,
        label: option.name,
        price_delta: Number(option.price_delta) || 0,
      })
      acc[option.group_id] = list
      return acc
    }, {})

    const enrichedGroups = (groups || []).map((group) => {
      const type = group.selection_type === 'multi' ? 'multi' : 'single'
      const min = typeof group.min_options === 'number' ? group.min_options : (group.required ? 1 : 0)
      const max = typeof group.max_options === 'number' ? group.max_options : (type === 'single' ? 1 : undefined)
      return {
        id: group.id,
        title: group.name,
        type,
        required: !!group.required || (min ?? 0) > 0,
        min,
        max,
        options: optionsByGroup[group.id] || [],
      }
    })

    return res.status(200).json({ groups: enrichedGroups })
  } catch (e) {
    console.error('API item options error:', e)
    return res.status(500).json({ error: 'Impossible de charger les options' })
  }
}
