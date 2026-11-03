export type CreationMode = 'text2img' | 'img2img' | 'fusion' | 'extract' | 'document'

export type Quality = 'draft' | 'standard' | 'high' | 'auto'

export type ImageSizePreset =
  | '1024x1024' | '1024x1536' | '1536x1024' | '1792x1024' | '1024x1792' | '900x383' | 'auto' | 'custom'
  | '1080x1440'
  | '1024x1792v' | '1792x1024v' | '2048x1152' | '1152x2048'
  | '2816x1984' | '1984x2816' | '2048x2048' | '3840x2160' | '2160x3840'

export type TaskStatus = 'queued' | 'running' | 'success' | 'failed'

export type HistoryFilter = 'all' | 'text2img' | 'img2img' | 'fusion' | 'document'

export interface ImageSize {
  preset: ImageSizePreset
  width: number
  height: number
}

export interface Model {
  id: string
  owned_by?: string
  displayName?: string
}

export interface GenerationTask {
  id: string
  mode: CreationMode
  prompt: string
  model: string
  size: string
  quality: string
  status: TaskStatus
  resultImages?: string[]
  referenceImages?: string[]
  revisedPrompt?: string
  error?: string
  duration?: number
  createdAt: number
  completedAt?: number
}

export interface HistoryItem {
  id: string
  mode: CreationMode
  prompt: string
  model: string
  size: string
  quality: string
  images: string[]
  duration: number
  createdAt: number
}

export interface QueueStats {
  success: number
  failed: number
  waiting: number
  running: number
}

export const MODE_LABELS: Record<CreationMode, string> = {
  text2img: '文字生图',
  img2img: '图生图',
  fusion: '多图融合',
  extract: '提示词提取',
  document: '文档生图',
}

/** 火山方舟 Seedream 系列要求图片面积至少 921600 像素（如 1280×720）。 */
export const ARK_MIN_IMAGE_AREA = 921600

/** 把过小的尺寸按比例放大到模型允许的最小面积，避免上游 400 InvalidParameter。 */
export function normalizeImageSize(size: string): string {
  const m = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(String(size || '').trim())
  if (!m) return size
  const ow = Number(m[1])
  const oh = Number(m[2])
  if (!ow || !oh) return size
  if (ow * oh >= ARK_MIN_IMAGE_AREA) return `${ow}x${oh}`
  const scale = Math.sqrt(ARK_MIN_IMAGE_AREA / (ow * oh))
  const round16 = (n: number) => Math.max(16, Math.ceil((n * scale) / 16) * 16)
  let w = round16(ow)
  let h = round16(oh)
  while (w * h < ARK_MIN_IMAGE_AREA) { w += 16; h += 16 }
  return `${w}x${h}`
}

export const SIZE_OPTIONS: { preset: ImageSizePreset; label: string; desc: string; w: number; h: number }[] = [
  // 2.35:1 公众号封面；900×383 只有 34 万像素，会被 Seedream 拒绝，这里用满足最小面积的 1600×680。
  { preset: '900x383', label: '1600 × 680', desc: '2.35:1 · 公众号封面', w: 1600, h: 680 },
  { preset: '1024x1024', label: '1024 × 1024', desc: '1:1 · 1K 方图（默认）', w: 1024, h: 1024 },
  { preset: '1024x1536', label: '1024 × 1536', desc: '2:3 · 常用竖图', w: 1024, h: 1536 },
  { preset: '1080x1440', label: '1080 × 1440', desc: '3:4 · 口播封面', w: 1080, h: 1440 },
  { preset: '1536x1024', label: '1536 × 1024', desc: '3:2 · 常用横图', w: 1536, h: 1024 },
  { preset: '1024x1792', label: '1024 × 1792', desc: '9:16 · 手机海报', w: 1024, h: 1792 },
  { preset: '1792x1024', label: '1792 × 1024', desc: '16:9 · 封面 / 宽屏', w: 1792, h: 1024 },
  { preset: '2048x1152', label: '2048 × 1152', desc: '16:9 · 2K 横图', w: 2048, h: 1152 },
  { preset: '1152x2048', label: '1152 × 2048', desc: '9:16 · 2K 竖图', w: 1152, h: 2048 },
  { preset: '2048x2048', label: '2048 × 2048', desc: '1:1 · 2K 方图', w: 2048, h: 2048 },
  { preset: '1984x2816', label: '1984 × 2816', desc: 'A3 · 竖版', w: 1984, h: 2816 },
  { preset: '2816x1984', label: '2816 × 1984', desc: 'A3 · 横版', w: 2816, h: 1984 },
  { preset: '2160x3840', label: '2160 × 3840', desc: '9:16 · 4K 竖图', w: 2160, h: 3840 },
  { preset: '3840x2160', label: '3840 × 2160', desc: '16:9 · 4K 横图', w: 3840, h: 2160 },
  { preset: 'custom', label: '自定义尺寸', desc: '16 的倍数 · 面积 ≥ 921600', w: 0, h: 0 },
]


export const QUALITY_OPTIONS: { value: Quality; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'standard', label: '标准' },
  { value: 'high', label: '高' },
  { value: 'auto', label: '自动' },
]

export const STYLE_DIRECTIONS = ['写实', '电商', '动漫', '海报', '产品图', '赛博朋克'] as const

export const IMAGE_MODELS = [
  'gpt-image-2',
  'dall-e-3',
  'dall-e-2',
]

export const TEXT_MODELS = [
  'gpt-4o-mini',
  'gpt-4.1-mini',
  'gpt-4o',
]

export const DEFAULT_API_BASE = ''


