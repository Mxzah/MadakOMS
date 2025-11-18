import { promises as fs } from 'fs'
import path from 'path'

export default async function handler(req, res) {
  const { slug } = req.query

  try {
    // For now, the item-category mapping is global to the demo menu
    const map = {
      'sante-taouk': path.join(process.cwd(), 'data', 'item_categories.json'),
    }
    const filePath = map[slug]
    if (!filePath) {
      return res.status(404).json({ error: 'Restaurant introuvable' })
    }

    const file = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(file)
    return res.status(200).json({ itemCategories: data })
  } catch (err) {
    console.error('API item-categories error:', err)
    return res.status(500).json({ error: 'Impossible de charger le mapping item-catégorie' })
  }
}
