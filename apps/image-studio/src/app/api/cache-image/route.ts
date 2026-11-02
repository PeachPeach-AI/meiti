import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

export const runtime = 'nodejs'

const MAX_BYTES = 20 * 1024 * 1024

function extFromType(type: string): string {
  if (type.includes('png')) return 'png'
  if (type.includes('webp')) return 'webp'
  if (type.includes('gif')) return 'gif'
  return 'jpg'
}

export async function POST(req: NextRequest) {
  let url = ''
  try {
    const body = await req.json()
    url = String(body?.url || '')
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  let res: Response
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'image2-studio-cache/1.0' },
    })
  } catch {
    clearTimeout(timer)
    return NextResponse.json({ error: 'download failed' }, { status: 502 })
  }
  clearTimeout(timer)

  if (!res.ok) {
    return NextResponse.json({ error: `download http ${res.status}` }, { status: 502 })
  }
  const type = res.headers.get('content-type') || ''
  if (!type.startsWith('image/')) {
    return NextResponse.json({ error: 'not an image' }, { status: 400 })
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: 'image too large' }, { status: 413 })
  }

  const ext = extFromType(type)
  const hash = crypto.createHash('sha1').update(buf).digest('hex')
  const dir = path.join(process.cwd(), 'public', 'generated')
  await fs.mkdir(dir, { recursive: true })
  const name = `${hash}.${ext}`
  await fs.writeFile(path.join(dir, name), buf)
  return NextResponse.json({ url: `/generated/${name}` })
}
