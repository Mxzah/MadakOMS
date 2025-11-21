import { fetchRestaurantMenu } from '../../../../lib/db/menu'

export default async function handler(req, res) {
  const { slug } = req.query

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug requis' })
  }

  try {
    const data = await fetchRestaurantMenu(slug)
    if (!data) {
      return res.status(404).json({ error: 'Restaurant introuvable' })
    }
    return res.status(200).json(data)
  } catch (error) {
    console.error('API menu error:', error)
    return res.status(500).json({ error: 'Impossible de charger le menu' })
  }
}
