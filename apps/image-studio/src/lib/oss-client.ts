interface OssShareConfig {
  ossEndpoint: string
  ossAccessKey: string
  ossSecretKey: string
  ossBucket: string
  ossRegion: string
  ossCdnDomain: string
}

export async function uploadAndShare(
  image: string,
  config: OssShareConfig
): Promise<string> {
  const res = await fetch('/api/oss/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-oss-endpoint': config.ossEndpoint,
      'x-oss-access-key': config.ossAccessKey,
      'x-oss-secret-key': config.ossSecretKey,
      'x-oss-bucket': config.ossBucket,
      'x-oss-region': config.ossRegion,
      'x-oss-cdn-domain': config.ossCdnDomain,
    },
    body: JSON.stringify({ image }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '上传失败')
  return data.url as string
}
