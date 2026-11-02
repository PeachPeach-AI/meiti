import { NextRequest } from 'next/server'
import { uploadToOss, generateOssKey } from '@/lib/oss'

export async function POST(request: NextRequest) {
  try {
    const endpoint = request.headers.get('x-oss-endpoint') || ''
    const accessKey = request.headers.get('x-oss-access-key') || ''
    const secretKey = request.headers.get('x-oss-secret-key') || ''
    const bucket = request.headers.get('x-oss-bucket') || ''
    const region = request.headers.get('x-oss-region') || ''
    const cdnDomain = request.headers.get('x-oss-cdn-domain') || ''

    if (!endpoint || !accessKey || !secretKey || !bucket) {
      return Response.json({ error: '请先在左侧配置对象存储' }, { status: 400 })
    }

    const { image } = await request.json()
    if (!image || typeof image !== 'string') {
      return Response.json({ error: '缺少图片数据' }, { status: 400 })
    }

    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches) {
      return Response.json({ error: '无效的图片格式' }, { status: 400 })
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
    const body = Buffer.from(matches[2], 'base64')
    const key = generateOssKey(ext)

    const result = await uploadToOss(
      { endpoint, accessKey, secretKey, bucket, region, cdnDomain },
      body,
      `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      key
    )

    return Response.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
