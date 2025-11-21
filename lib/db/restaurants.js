import { supabaseClient } from '../supabase/client'

export async function fetchRestaurantBySlug(slug) {
  const { data, error } = await supabaseClient
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  return data
}
