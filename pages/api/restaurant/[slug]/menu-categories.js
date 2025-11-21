import { supabaseClient } from '../../../../lib/supabase/client'
import { fetchRestaurantBySlug } from '../../../../lib/db/restaurants'

export default async function handler(req, res) {
  const { slug } = req.query

  try {
    const restaurant = await fetchRestaurantBySlug(slug)
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant introuvable' })
    }

    const { data, error } = await supabaseClient
      .from('menu_categories')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error

    return res.status(200).json({ categories: data })
  } catch (err) {
    console.error('API menu-categories error:', err)
    return res.status(500).json({ error: 'Impossible de charger les catégories' })
  }
}
