// Vercel Serverless Function - Player visit counter
// Uses Vercel KV (Redis) if available, falls back to in-memory count
// Deploy on Vercel with `npx vercel` - the /api/counter route is automatic

let memoryCount = 0

export default async function handler(req: { method: string }, res: {
  status: (code: number) => { json: (data: unknown) => void }
  setHeader: (key: string, value: string) => void
}) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(200).json({})
  }

  // Try Vercel KV first (persistent across deployments)
  try {
    const { kv } = await import('@vercel/kv')
    const count = await kv.incr('duo-world:visits')
    return res.status(200).json({ count })
  } catch {
    // Vercel KV not configured - use in-memory fallback
  }

  // In-memory fallback (resets on cold start, but works for demo)
  if (req.method === 'POST') {
    memoryCount++
  }
  return res.status(200).json({ count: memoryCount })
}
