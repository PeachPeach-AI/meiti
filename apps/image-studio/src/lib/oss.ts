import { createHash, createHmac, randomBytes } from 'crypto'

function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

function hmacSha256(key: Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest()
}

function getSignatureKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(Buffer.from('AWS4' + secretKey, 'utf-8'), dateStamp)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, service)
  return hmacSha256(kService, 'aws4_request')
}

export interface OssConfig {
  endpoint: string
  accessKey: string
  secretKey: string
  bucket: string
  region: string
  cdnDomain?: string
}

export interface UploadResult {
  url: string
  key: string
}

export function generateOssKey(ext?: string): string {
  const bytes = randomBytes(12)
  const ts = Date.now().toString(36)
  return `image2/${ts}-${bytes.toString('hex')}.${ext || 'png'}`
}

export async function uploadToOss(
  config: OssConfig,
  body: Buffer,
  contentType: string,
  key: string
): Promise<UploadResult> {
  const { endpoint, accessKey, secretKey, bucket, region, cdnDomain } = config

  const url = new URL(endpoint)
  const host = url.host
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  const objectPath = `/${bucket}/${key}`
  const payloadHash = sha256Hex(body)

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = `PUT\n${objectPath}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`

  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region || 'us-east-1'}/s3/aws4_request`
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`

  const signingKey = getSignatureKey(secretKey, dateStamp, region || 'us-east-1', 's3')
  const signature = hmacSha256(signingKey, stringToSign).toString('hex')

  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const targetUrl = `${url.origin}${objectPath}`

  const response = await fetch(targetUrl, {
    method: 'PUT',
    headers: {
      'Host': host,
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authorization,
    },
    body: body as unknown as BodyInit,
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`OSS 上传失败: ${response.status} ${text.slice(0, 200)}`)
  }

  const publicUrl = cdnDomain
    ? `${cdnDomain.replace(/\/+$/, '')}/${key}`
    : `${url.origin}/${bucket}/${key}`

  return { url: publicUrl, key }
}
