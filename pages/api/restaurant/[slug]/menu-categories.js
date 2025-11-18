import { promises as fs } from 'fs'
import path from 'path'

export default async function handler(req, res) {
  const { slug } = req.query

  try {
    const map = {
      'sante-taouk': path.join(process.cwd(), 'data', 'menu_categories.json'),
    }
    const filePath = map[slug]
    if (!filePath) {
      return res.status(404).json({ error: 'Restaurant introuvable' })
    }

    const file = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(file)
    return res.status(200).json({ categories: data })
  } catch (err) {
    console.error('API menu-categories error:', err)
    return res.status(500).json({ error: 'Impossible de charger les catégories' })
  }
}
