function buildTargetUrl(apiBaseUrl: string, endpoint: string): string {
  const url = new URL(apiBaseUrl)
  const baseUrl = url.origin + url.pathname.replace(/\/+$/, '')
  const cleanEndpoint = endpoint.replace(/^\/+/, '')
  return cleanEndpoint ? `${baseUrl}/${cleanEndpoint}` : baseUrl
}

function isHtmlResponse(contentType: string | null, text: string): boolean {
  return contentType?.includes('text/html') || /^\s*(<!doctype html|<html)\b/i.test(text)
}

function responsePreview(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, 300)
}

async function proxyRequest(request: Request, method: 'GET' | 'POST') {
  const apiBaseUrl = request.headers.get('X-Api-Base-Url') || ''
  const apiKey = request.headers.get('X-Api-Key') || ''
  const endpoint = request.headers.get('X-Api-Endpoint') || ''

  if (!apiBaseUrl) {
    return Response.json({ error: '请先填写 API 站地址' }, { status: 400 })
  }

  // 生图/生视频是同步长任务：Seedream 带参考图、高分辨率时经常 60s 以上，
  // 原来统一 60s 会误判成「上游超时」。对话/模型列表仍保持 60s。
  const isMediaTask = /images\/(generations|edits)|\/video\/generations/i.test(endpoint)
  const timeoutMs = isMediaTask ? 300000 : 60000

  let targetUrl: string
  try {
    targetUrl = buildTargetUrl(apiBaseUrl, endpoint)
  } catch {
    return Response.json({ error: 'API 站地址格式错误，需以 http:// 或 https:// 开头' }, { status: 400 })
  }

  try {
    const body = method === 'POST' ? await request.text() : ''
    const res = await fetch(targetUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      } as Record<string, string>,
      body: method === 'POST' && body ? body : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    })

    const text = await res.text()
    const contentType = res.headers.get('Content-Type')

    if (isHtmlResponse(contentType, text)) {
      return Response.json({
        error: `上游返回了 HTML 页面，不是 JSON API。请检查 API 站地址是否应包含 /v1，当前请求：${targetUrl}。响应预览：${responsePreview(text)}`,
      }, { status: 502 })
    }

    if (!res.ok) {
      return Response.json({ error: `上游返回 ${res.status}: ${responsePreview(text)}` }, { status: res.status })
    }

    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': contentType || 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('abort') || msg.includes('timeout')) {
      return Response.json({
        error: `请求超时（${Math.round(timeoutMs / 1000)}s），上游 API 无响应。生图带参考图时可能需要 1-3 分钟，请稍后重试或减少参考图。`,
      }, { status: 504 })
    }
    return Response.json({ error: `无法连接到 API 站: ${msg}` }, { status: 502 })
  }
}

export async function POST(request: Request) {
  return proxyRequest(request, 'POST')
}

export async function GET(request: Request) {
  return proxyRequest(request, 'GET')
}
