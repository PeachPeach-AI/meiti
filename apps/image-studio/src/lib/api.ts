import type { GenerationTask, Model, HistoryItem } from '@/types'

let taskCounter = 0

export function generateId(): string {
  taskCounter++
  return `${Date.now()}-${taskCounter}-${Math.random().toString(36).slice(2, 8)}`
}

async function apiFetch(
  apiBaseUrl: string,
  apiKey: string,
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  if (!apiBaseUrl) throw new Error('请先填写 API 站地址')
  const method = (options.method || 'GET').toString().toUpperCase()
  const hasBody = method !== 'GET' && method !== 'HEAD'

  // Ark 上的 DeepSeek 默认走 reasoning，content 会为空；关掉 thinking 才能拿到正文。
  let body = options.body
  if (hasBody && typeof body === 'string' && /ark\.cn-beijing|volces/i.test(apiBaseUrl)) {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>
      if (/deepseek/i.test(String(parsed.model || ''))) {
        parsed.thinking = { type: 'disabled' }
        body = JSON.stringify(parsed)
      }
    } catch { /* keep original body */ }
  }

  const res = await fetch('/api/proxy', {
    method,
    body: hasBody ? body : undefined,
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Base-Url': apiBaseUrl,
      'X-Api-Endpoint': path,
      ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
    },
  })

  const text = await res.text()
  let data: unknown

  try {
    data = JSON.parse(text)
  } catch {
    const preview = text.replace(/\s+/g, ' ').slice(0, 160)
    throw new Error('响应非 JSON 格式，可能请求到了网页而不是 API：' + preview + '...')
  }

  if (!res.ok) {
    const raw = (data as Record<string, unknown>)?.error
    const err = typeof raw === 'string'
      ? raw
      : (raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).message === 'string')
        ? String((raw as Record<string, unknown>).message)
        : `HTTP ${res.status}`
    throw new Error(String(err))
  }

  return data
}

export async function fetchModels(apiBaseUrl: string, apiKey: string): Promise<Model[]> {
  const data = await apiFetch(apiBaseUrl, apiKey, 'models') as { data?: Model[] }
  return (data.data || []).map((m: Model) => ({ ...m, displayName: m.displayName || m.id }))
}

export interface CoverPromptInput {
  brief: string
  title?: string
  style?: string
  face?: string | null
  backgroundImage?: string | null
  expression?: string
  background?: string
  font?: string
  color?: string
}

const COVER_STYLES = [
  '深色渐变风：人物居中，大字压在后面，冲击力最强',
  '纯色扁平风：人物 + 道具 + 纯色背景，干净清爽',
  '产品主视觉风：有 UI 截图或产品图时，截图占主体',
  '对比卡片风：前后对比、好坏对比类内容',
  '极简留白风：大留白，标题是唯一焦点',
  '海报拼贴风：素材多时多层叠加，纵深感强',
  '人物侧置留白风：人物偏一侧，另一边全给标题',
  '背影构图风：人物背对镜头，适合励志、启发类内容',
  '局部出镜风：只露手或半张脸，产品是主角',
  '正面对视风：直视镜头，眼神接触，情绪直接',
].join('\n')

export async function generateCoverPrompt(
  apiBaseUrl: string,
  apiKey: string,
  textModel: string,
  input: CoverPromptInput
): Promise<string> {
  const styleLine = input.style && input.style !== 'auto'
    ? `用户指定风格：${input.style}`
    : '用户没有指定风格：请从下面 10 种里选最适合这条口播内容的一种，并在提示词里明确写出风格名。'
  const userText = [
    '请根据下面的口播内容，生成一张抖音/小红书/视频号 3:4 竖版口播封面提示词。',
    '',
    `口播稿/主题：${input.brief}`,
    `用户给定标题：${input.title || '（未给，请你拟一个 8-14 个中文字符的强钩子标题）'}`,
    styleLine,
    `表情：${input.expression || '自然、有交流感，按内容决定'}`,
    `背景色调：${input.background || '按风格和内容决定'}`,
    `字体：${input.font || '粗黑体/思源黑体 Heavy，中文标题清晰有力'}`,
    `字色：${input.color || '白色或高对比色，保证手机小屏可读'}`,
    input.face ? '已提供一张人脸参考图：请把人物写成“与参考图同一张脸、同一人”，只描述造型/服装/表情，不要改变五官身份。' : '没有提供人脸参考图：人物写“真人出镜口播”，不要编造具体明星脸。',
    input.backgroundImage ? '已提供一张背景参考图：请把背景写成“沿用参考图底图的配色、材质与主要装饰元素”，但不要照抄其中的文字、水印和 logo；标题区留白按参考图的大致版式安排。' : '没有提供背景参考图：背景按风格和内容决定。',
    input.face && input.backgroundImage
      ? '参考图顺序：第 1 张是人脸参考图，第 2 张是背景底图参考图。'
      : input.backgroundImage
        ? '参考图只有 1 张：背景底图参考图。'
        : '',
  ].filter(Boolean).join('\n')

  const system = [
    '你是 gbro-cover-design 口播封面提示词专家。',
    '只输出一段可直接交给图像生成模型的中文提示词，不要解释、不要 Markdown、不要分点。',
    '硬性要求：',
    '- 画幅固定 3:4 竖版，输出尺寸 1080x1440；',
    '- 真人出镜口播封面，人物占画面主体，脸部清晰，眼神/表情有交流感；',
    '- 标题必须是大字、强钩子、手机小屏可读；标题放在画面上方或人物侧边安全区，不挡脸；',
    '- 画面干净，不要堆太多小字，不要廉价模板感；',
    '- 如果用户给了人脸参考图，必须强调保持同一张脸、同一人，不改变五官；',
    '- 如果用户给了背景参考图，必须强调背景沿用参考图的配色、材质与装饰元素，同时给标题留出干净区域；',
    '- 提示词里要包含：风格、人物位置/景别、标题文字、字体、字色、背景、光线、色彩、构图安全区；',
    '- 审美方向：高级杂志封面 / 真实商业摄影，85mm 人像，柔和侧光，浅景深，真实皮肤质感，低饱和配色，留白至少 25%；',
    '- 标题最多两行，主标题与副标题字重对比明显，排版干净，不要压住眼睛和嘴；',
    '- 禁止：3D 渲染感、塑料皮肤、过度磨皮、廉价模板、夸张渐变、贴纸、边框、水印、logo、杂乱小字；',
    '- 结尾加一句“无多余文字、无水印、无 logo、画面干净”。',
    '10 种可选风格：',
    COVER_STYLES,
  ].join('\n')

  const refImages: string[] = []
  if (input.face) refImages.push(input.face)
  if (input.backgroundImage) refImages.push(input.backgroundImage)
  const messages: Record<string, unknown>[] = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: refImages.length
        ? [
            { type: 'text', text: userText },
            ...refImages.map((url) => ({ type: 'image_url', image_url: { url } })),
          ]
        : userText,
    },
  ]

  const call = () => apiFetch(apiBaseUrl, apiKey, 'chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: textModel, messages, max_tokens: 2000, temperature: 0.7 }),
  }) as Promise<{ choices?: { message?: { content?: string } }[] }>

  let data: { choices?: { message?: { content?: string } }[] }
  try {
    data = await call()
  } catch (err) {
    // 有些文本模型不支持图片输入：去掉参考图重试一次，仍失败则抛出。
    if (!refImages.length) throw err
    messages[1] = { role: 'user', content: userText }
    data = await call()
  }

  let out = (data.choices?.[0]?.message?.content || '').trim()
  out = out.replace(/^```(?:markdown|text|md)?\s*/i, '').replace(/```\s*$/i, '').trim()
  if (!out) throw new Error('文本模型没有返回封面提示词')
  return out
}

export interface NoteCard {
  heading: string
  body: string
}

export interface NoteData {
  title: string
  subtitle?: string
  cards: NoteCard[]
  tags?: string[]
}

export interface NoteInput {
  topic: string
  count: number
  style: string
}

function stripCodeFence(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/^\s*```(?:json|markdown|text|md)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
}

function escapeControlCharsInStrings(text: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (const ch of text) {
    if (escaped) { out += ch; escaped = false; continue }
    if (ch === '\\') { out += ch; escaped = true; continue }
    if (ch === '"') { out += ch; inString = !inString; continue }
    if (inString) {
      if (ch === '\n') { out += '\\n'; continue }
      if (ch === '\r') continue
      if (ch === '\t') { out += '\\t'; continue }
      const code = ch.charCodeAt(0)
      if (code < 0x20) { out += `\\u${code.toString(16).padStart(4, '0')}`; continue }
    }
    out += ch
  }
  return out
}

function repairJson(text: string): string {
  let s = text.trim()
  s = s.replace(/,\s*([}\]])/g, '$1')
  s = escapeControlCharsInStrings(s)

  // 自动补全被截断的 } / ]（只在字符串外计数）
  const stack: string[] = []
  let inString = false
  let escaped = false
  for (const ch of s) {
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}' || ch === ']') stack.pop()
  }
  while (stack.length) {
    const open = stack.pop()
    s += open === '{' ? '}' : ']'
  }
  return s
}

function findMatchingBrace(text: string, start: number): number {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function parseJsonLoose(raw: string): unknown {
  const cleaned = stripCodeFence(raw)
  const candidates: string[] = [cleaned]
  const start = cleaned.indexOf('{')
  if (start >= 0) {
    const end = findMatchingBrace(cleaned, start)
    if (end > start) candidates.unshift(cleaned.slice(start, end + 1))
  }
  for (const candidate of candidates) {
    for (const text of [candidate, repairJson(candidate)]) {
      try { return JSON.parse(text) } catch { /* try next */ }
    }
  }
  return null
}

function normalizeNote(value: unknown, count: number): NoteData | null {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>
  const root = (obj.data && typeof obj.data === 'object' ? obj.data : obj) as Record<string, unknown>
  const cover = (root.cover && typeof root.cover === 'object' ? root.cover : {}) as Record<string, unknown>
  const rawCards = Array.isArray(root.cards)
    ? root.cards
    : Array.isArray(root.cardList) ? root.cardList : Array.isArray(root.list) ? root.list : []
  const cards = rawCards.map((c) => {
    const card = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
    return {
      heading: String(card.heading ?? card.title ?? card.subtitle ?? '').trim(),
      body: String(card.body ?? card.content ?? card.text ?? '').trim(),
    }
  }).filter((c) => c.heading || c.body).slice(0, count)
  const title = String(root.title ?? cover.title ?? '').trim()
  if (!title || cards.length === 0) return null
  const subtitle = String(root.subtitle ?? cover.subtitle ?? '').trim()
  const rawTags = root.tags
  const tags = Array.isArray(rawTags)
    ? rawTags.map((t) => String(t).replace(/^#/, '').trim()).filter(Boolean)
    : typeof rawTags === 'string'
      ? rawTags.split(/[\s,，#]+/).map((t) => t.trim()).filter(Boolean)
      : []
  return { title, subtitle, cards, tags }
}

export async function generateNoteCards(
  apiBaseUrl: string,
  apiKey: string,
  textModel: string,
  input: NoteInput
): Promise<NoteData> {
  const system = [
    '你是小红书图文笔记策划。把用户给的文章/主题拆成一套适合 3:4 竖版图文的卡片文案。',
    '只输出一个严格 JSON 对象，不要 Markdown，不要解释，不要代码块，不要前后缀。',
    '所有 key 和字符串必须使用英文双引号；字符串内部不要出现真实换行，需要换行请用 \\n。',
    'JSON 结构必须是：',
    '{"title":"封面主标题","subtitle":"封面副标题","cards":[{"heading":"卡片小标题","body":"卡片正文"}],"tags":["标签1","标签2"]}',
    '要求：',
    `- cards 数组正好 ${input.count} 项；`,
    '- title 不超过 18 个中文字符，必须有钩子；subtitle 不超过 32 个字符；',
    '- 每张卡片 heading 不超过 14 个字符，body 60-120 个中文字符，口语化、具体、有信息量；',
    '- 第 1 张卡片承接封面，最后 1 张卡片做总结/互动引导；',
    '- tags 给 5-8 个不带 # 的小红书标签；',
    `- 视觉风格：${input.style}；文案要贴合这个风格，但不要写排版说明。`,
    '- 最后再检查一遍：必须是合法 JSON，不要输出 JSON 以外的任何字符。',
  ].join('\n')

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: system },
    { role: 'user', content: `文章/主题：\n${input.topic}\n\n请只输出 JSON。` },
  ]

  const call = async (jsonMode: boolean, temperature: number) => {
    const body: Record<string, unknown> = {
      model: textModel,
      messages,
      max_tokens: 4096,
      temperature,
    }
    if (jsonMode) body.response_format = { type: 'json_object' }
    const data = await apiFetch(apiBaseUrl, apiKey, 'chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as { choices?: { message?: { content?: string } }[] }
    return (data.choices?.[0]?.message?.content || '').trim()
  }

  let lastRaw = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw = ''
    try {
      raw = await call(true, attempt === 0 ? 0.5 : 0.2)
    } catch (err) {
      if (attempt === 0) {
        // 有些 OpenAI 兼容服务不支持 response_format，去掉再试。
        raw = await call(false, 0.4)
      } else {
        throw err
      }
    }
    lastRaw = raw
    const parsed = parseJsonLoose(raw)
    const note = normalizeNote(parsed, input.count)
    if (note) return note

    if (attempt === 0) {
      messages.push({
        role: 'assistant',
        content: raw.slice(0, 3000),
      })
      messages.push({
        role: 'user',
        content: '上面不是合法 JSON。请严格只输出 JSON，不要 Markdown、不要解释、不要前后缀。',
      })
    }
  }

  throw new Error(`文本模型（${textModel}）返回的不是有效 JSON；已自动重试 2 次。请在 Easel 设置里换用支持 JSON 的文本模型（如 gpt-4o-mini / deepseek-chat）后重试。`)
}


export async function generateImage(
  apiBaseUrl: string,
  apiKey: string,
  task: GenerationTask
): Promise<GenerationTask> {
  const isArk = /volces\.com|ark\.cn-beijing|seedream|doubao/i.test(`${apiBaseUrl} ${task.model}`)
  const refs = (task.referenceImages || []).filter(Boolean)
  const body: Record<string, unknown> = {
    model: task.model,
    prompt: task.prompt,
    size: task.size,
    response_format: isArk ? 'url' : 'b64_json',
  }

  if (isArk) {
    body.watermark = false
    if (refs.length) {
      body.image = refs.length === 1 ? refs[0] : refs
    }
  } else {
    body.n = 1
    if (refs.length) {
      body.image = refs.length === 1 ? refs[0] : refs
    }
    if (task.quality && task.quality !== 'auto') {
      body.quality = task.quality
    }
  }

  const call = () => apiFetch(apiBaseUrl, apiKey, 'images/generations', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Promise<{ data?: { b64_json?: string; url?: string; revised_prompt?: string }[] }>

  let data: { data?: { b64_json?: string; url?: string; revised_prompt?: string }[] }
  try {
    data = await call()
  } catch (err) {
    if (isArk) throw err
    // 非 Ark 的 OpenAI 兼容服务不一定支持 image 参考图参数；
    // 带图失败时退回纯文生图，避免整次生成直接失败。
    body.response_format = 'url'
    delete body.n
    delete body.quality
    delete body.image
    data = await call()
  }

  const rawImages: string[] = (data.data || []).map((d) => {
    if (d.b64_json) return `data:image/png;base64,${d.b64_json}`
    return d.url || ''
  })

  // Ark/Seedream 返回的是临时签名 URL，过期后历史里的图片会 404。
  // 生成后立即下载到本地 public/generated，历史记录保存本地路径。
  const images = await Promise.all(rawImages.map(async (src) => {
    if (!src || !src.startsWith('http')) return src
    try {
      const r = await fetch('/api/cache-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: src }),
      })
      if (r.ok) {
        const j = await r.json() as { url?: string }
        if (j.url) return j.url
      }
    } catch { /* fallback remote */ }
    return src
  }))


  return {
    ...task,
    status: 'success',
    resultImages: images,
    revisedPrompt: data.data?.[0]?.revised_prompt || undefined,
    completedAt: Date.now(),
    duration: Date.now() - task.createdAt,
  }
}

export function taskToHistory(task: GenerationTask): HistoryItem {
  return {
    id: task.id,
    mode: task.mode,
    prompt: task.prompt,
    model: task.model,
    size: task.size,
    quality: task.quality,
    images: task.resultImages || [],
    duration: task.duration || 0,
    createdAt: task.createdAt,
  }
}

export async function cleanPrompt(
  apiBaseUrl: string,
  apiKey: string,
  textModel: string,
  prompt: string
): Promise<string> {
  const data = await apiFetch(apiBaseUrl, apiKey, 'chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: textModel,
      messages: [
        {
          role: 'system',
          content: 'You are a professional AI image prompt optimizer. Expand the user input into a detailed English image generation prompt including subject, style, composition, lighting, color. Output only the optimized prompt.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
    }),
  })
  return (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content || prompt
}

export async function extractPromptFromImage(
  apiBaseUrl: string,
  apiKey: string,
  textModel: string,
  imageBase64: string
): Promise<string> {
  const data = await apiFetch(apiBaseUrl, apiKey, 'chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: textModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image in detail: content, style, composition, lighting, colors. Output an English AI image prompt only.' },
            { type: 'image_url', image_url: { url: imageBase64 } },
          ],
        },
      ],
      max_tokens: 4000,
    }),
  })
  return (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content || ''
}


export async function expandPrompt(
  apiBaseUrl: string,
  apiKey: string,
  textModel: string,
  prompt: string
): Promise<string> {
  const data = await apiFetch(apiBaseUrl, apiKey, 'chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: textModel,
      messages: [
        {
          role: 'system',
          content: 'You are a professional AI image prompt ideation assistant. Expand the user input into a richer image-generation prompt with subject, scene, style, composition, lighting, color, details, and camera/lens language where appropriate. Output only the final prompt.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
    }),
  })
  return (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content || prompt
}
export async function associatePrompt(
  apiBaseUrl: string,
  apiKey: string,
  textModel: string,
  prompt: string,
  direction: string
): Promise<string> {
  const data = await apiFetch(apiBaseUrl, apiKey, 'chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: textModel,
      messages: [
        {
          role: 'system',
          content: `Expand this into a detailed ${direction}-style English image prompt with subject, style, composition, lighting, colors. Output only the prompt.`,
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
    }),
  })
  return (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content || prompt
}

export function createThumbnail(base64: string, maxSize = 120): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ratio = Math.min(maxSize / img.width, maxSize / img.height)
      canvas.width = img.width * ratio
      canvas.height = img.height * ratio
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no ctx')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = reject
    img.src = base64
  })
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = (ms / 1000).toFixed(1)
  return `${s}s`
}







