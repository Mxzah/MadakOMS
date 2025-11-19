import { promises as fs } from 'fs'
import path from 'path'

export default async function handler(req, res) {
  const { slug, id } = req.query
  try {
    const map = {
      'sante-taouk': path.join(process.cwd(), 'data', 'item_options.json'),
    }
    const filePath = map[slug]
    if (!filePath) return res.status(404).json({ error: 'Restaurant introuvable' })
    const file = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(file)
    const entry = data.find((e) => String(e.item_id) === String(id))
    return res.status(200).json({ groups: entry?.groups || [] })
  } catch (e) {
    console.error('API item options error:', e)
    return res.status(500).json({ error: 'Impossible de charger les options' })
  }
}
