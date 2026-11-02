'use client'

import React from 'react'
import { useAppStore } from '@/store'
import { generateNoteCards, type NoteData } from '@/lib/api'
import { BUILTIN_BACKGROUNDS, type BuiltinBackground } from '@/lib/coverAssets'
import JSZip from 'jszip'
import {
  X, Sparkles, Download, Copy, Check, AlertCircle,
  LayoutGrid, RefreshCw, Image as ImageIcon,
  ChevronLeft, ChevronRight,
} from 'lucide-react'

const W = 1080
const H = 1440
const FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif'

const NOTE_STYLES = [
  {
    id: 'white',
    name: '素白杂志',
    desc: '暖白底 + 墨黑字 + 红色强调',
    bg1: '#fbfaf7', bg2: '#f1ece3', fg: '#111827', sub: '#374151', accent: '#e11d48', soft: '#9ca3af',
  },
  {
    id: 'dark',
    name: '墨黑杂志',
    desc: '深黑底 + 米白字 + 金色强调',
    bg1: '#080808', bg2: '#161616', fg: '#f8fafc', sub: '#cbd5e1', accent: '#eab308', soft: '#a1a1aa',
  },
  {
    id: 'paper',
    name: '奶油纸张',
    desc: '奶油纸底 + 深棕字 + 陶土强调',
    bg1: '#fdfbf7', bg2: '#f4ece0', fg: '#1c1917', sub: '#44403c', accent: '#b91c1c', soft: '#a8a29e',
  },
]

type NoteStyle = typeof NOTE_STYLES[number]

interface NoteTypography {
  font: string
  titleSize: number
  bodySize: number
  titleWeight: number
  bodyWeight: number
  titleColor: string
  bodyColor: string
  accentColor: string
}

const FONT_OPTIONS = [
  { id: 'yahei', name: '微软雅黑', value: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif' },
  { id: 'simhei', name: '黑体', value: '"SimHei", "Microsoft YaHei", sans-serif' },
  { id: 'simsun', name: '宋体', value: '"SimSun", "Songti SC", serif' },
  { id: 'kaiti', name: '楷体', value: '"KaiTi", "Kaiti SC", serif' },
  { id: 'youyuan', name: '幼圆', value: '"YouYuan", "Microsoft YaHei", sans-serif' },
]

interface RenderedCard {
  id: string
  label: string
  src: string
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of String(text || '').split('\n')) {
    if (!paragraph) { lines.push(''); continue }
    let line = ''
    for (const ch of paragraph) {
      const next = line + ch
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line)
        line = ch
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  color: string,
  weight = 400,
  maxLines = 99,
  font = FONT,
) {
  ctx.fillStyle = color
  ctx.font = `${weight} ${fontSize}px ${font}`
  ctx.textBaseline = 'top'
  const lines = wrapLines(ctx, text, maxWidth)
  const shown = lines.length > maxLines ? [...lines.slice(0, maxLines - 1), lines[maxLines - 1].slice(0, -1) + '…'] : lines
  shown.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight))
  return y + shown.length * lineHeight
}

function drawBase(
  ctx: CanvasRenderingContext2D,
  theme: NoteStyle,
  page: number,
  total: number,
  label: string,
  bgImg: HTMLImageElement | null,
) {
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, W, H)
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, theme.bg1)
    g.addColorStop(1, theme.bg2)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  const pad = bgImg ? 220 : 88
  const top = bgImg ? 150 : 84

  ctx.fillStyle = theme.accent
  ctx.beginPath()
  ctx.arc(pad, top + 12, 7, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = theme.sub
  ctx.font = `500 22px ${FONT}`
  ctx.textBaseline = 'top'
  ctx.fillText(label, pad + 18, top)

  ctx.textAlign = 'right'
  ctx.fillStyle = theme.sub
  ctx.font = `500 22px ${FONT}`
  ctx.fillText(`${page} / ${total}`, W - pad, top)
  ctx.textAlign = 'left'
}

function drawTags(ctx: CanvasRenderingContext2D, tags: string[], style: NoteStyle, x: number, y: number, font = FONT) {
  if (!tags.length) return
  const text = tags.map((t) => `#${t}`).join('  ')
  drawWrapped(ctx, text, x, y, W - x * 2, 26, 38, style.soft, 500, 2, font)
}

function renderCover(data: NoteData, theme: NoteStyle, total: number, bgImg: HTMLImageElement | null, type: NoteTypography, accountName: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')

  drawBase(ctx, theme, 1, total, accountName.trim() ? `口播笔记 · @${accountName.trim().slice(0, 14)}` : '口播笔记', bgImg)

  const pad = bgImg ? 220 : 88
  const titleY = bgImg ? 300 : 250
  const baseTitleSize = Math.max(48, Math.min(140, type.titleSize))
  let titleSize = baseTitleSize
  let lines: string[] = []
  for (const size of [baseTitleSize, baseTitleSize - 10, baseTitleSize - 20, baseTitleSize - 30].filter((s) => s >= 44)) {
    ctx.font = `${type.titleWeight} ${size}px ${type.font}`
    lines = wrapLines(ctx, data.title, W - pad * 2)
    if (lines.length <= 4) { titleSize = size; break }
  }
  drawWrapped(ctx, data.title, pad, titleY, W - pad * 2, titleSize, Math.round(titleSize * 1.16), theme.fg, type.titleWeight, 4, type.font)

  const titleBottom = titleY + Math.min(lines.length, 4) * Math.round(titleSize * 1.16)
  ctx.fillStyle = theme.accent
  roundRect(ctx, pad, titleBottom + 26, 136, 8, 4)
  ctx.fill()

  if (data.subtitle) {
    const subSize = Math.max(22, Math.round(type.bodySize * 0.95))
    drawWrapped(ctx, data.subtitle, pad, titleBottom + 66, W - pad * 2, subSize, Math.round(subSize * 1.45), theme.sub, 500, 3, type.font)
  }

  drawTags(ctx, data.tags || [], theme, pad, H - (bgImg ? 340 : 200), type.font)

  ctx.fillStyle = theme.sub
  ctx.font = `500 22px ${type.font}`
  ctx.fillText('下滑看完整内容  ›', pad, H - (bgImg ? 250 : 100))

  return canvas.toDataURL('image/png')
}

function renderContentCard(
  card: { heading: string; body: string },
  theme: NoteStyle,
  page: number,
  total: number,
  isLast: boolean,
  tags: string[],
  bgImg: HTMLImageElement | null,
  type: NoteTypography,
  accountName: string,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')

  drawBase(ctx, theme, page, total, accountName.trim() ? `口播笔记 · @${accountName.trim().slice(0, 14)}` : '口播笔记', bgImg)

  const pad = bgImg ? 220 : 88
  const indexY = bgImg ? 250 : 196
  const headingY = bgImg ? 300 : 238
  const maxBodyLines = bgImg ? 8 : 12
  const headingSize = Math.max(38, Math.round(type.titleSize * 0.62))

  ctx.fillStyle = theme.accent
  ctx.font = `700 24px ${type.font}`
  ctx.textBaseline = 'top'
  ctx.fillText(String(page - 1).padStart(2, '0'), pad, indexY)

  const headingBottom = drawWrapped(ctx, card.heading, pad, headingY, W - pad * 2, headingSize, Math.round(headingSize * 1.28), theme.fg, type.titleWeight, 2, type.font)

  ctx.fillStyle = theme.accent
  roundRect(ctx, pad, headingBottom + 24, 88, 7, 3.5)
  ctx.fill()

  let bodySize = type.bodySize
  let bodyLines: string[] = []
  for (const size of [type.bodySize, type.bodySize - 3, type.bodySize - 6, type.bodySize - 9].filter((s) => s >= 22)) {
    ctx.font = `${type.bodyWeight} ${size}px ${type.font}`
    bodyLines = wrapLines(ctx, card.body, W - pad * 2)
    if (bodyLines.length <= maxBodyLines) { bodySize = size; break }
  }
  drawWrapped(ctx, card.body, pad, headingBottom + 66, W - pad * 2, bodySize, Math.round(bodySize * 1.62), theme.sub, type.bodyWeight, maxBodyLines, type.font)

  if (isLast) {
    drawTags(ctx, tags, theme, pad, H - (bgImg ? 340 : 220), type.font)
    ctx.fillStyle = theme.accent
    ctx.font = `700 28px ${type.font}`
    ctx.fillText('收藏 · 点赞 · 关注', pad, H - (bgImg ? 250 : 140))
  }

  return canvas.toDataURL('image/png')
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('底图加载失败'))
    img.src = src
  })
}

async function renderAll(data: NoteData, style: NoteStyle, bg: BuiltinBackground | null, type: NoteTypography, accountName: string): Promise<RenderedCard[]> {
  const tags = data.tags || []
  const total = 1 + data.cards.length
  const bgImg = bg ? await loadImage(bg.src) : null
  const theme: NoteStyle = {
    ...style,
    fg: type.titleColor,
    sub: type.bodyColor,
    accent: type.accentColor,
    soft: type.bodyColor,
  }

  const out: RenderedCard[] = [
    { id: 'cover', label: '封面', src: renderCover(data, theme, total, bgImg, type, accountName) },
  ]
  data.cards.forEach((card, idx) => {
    out.push({
      id: `card-${idx + 1}`,
      label: `第 ${idx + 1} 张`,
      src: renderContentCard(card, theme, idx + 2, total, idx === data.cards.length - 1, tags, bgImg, type, accountName),
    })
  })
  return out
}

function noteToText(data: NoteData, accountName = ''): string {
  const tags = (data.tags || []).map((t) => `#${t}`).join(' ')
  return [
    data.title,
    data.subtitle || '',
    '',
    ...data.cards.map((c) => `${c.heading}\n${c.body}\n`),
    tags,
    accountName.trim() ? `@${accountName.trim()}` : '',
  ].filter((x) => x !== undefined).join('\n').trim()
}

interface Props {
  open: boolean
  onClose: () => void
}

export function NoteDesignModal({ open, onClose }: Props) {
  const { textApiKey, textApiBaseUrl, selectedTextModel } = useAppStore()

  const [topic, setTopic] = React.useState('')
  const [count, setCount] = React.useState(6)
  const [bgId, setBgId] = React.useState<string>('material-01')
  const [accountName, setAccountName] = React.useState('')
  const [fontId, setFontId] = React.useState('yahei')
  const [titleSize, setTitleSize] = React.useState(96)
  const [bodySize, setBodySize] = React.useState(38)
  const [titleColor, setTitleColor] = React.useState('#1c1917')
  const [bodyColor, setBodyColor] = React.useState('#44403c')
  const [accentColor, setAccentColor] = React.useState('#ea580c')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [data, setData] = React.useState<NoteData | null>(null)
  const [images, setImages] = React.useState<RenderedCard[]>([])
  const [copied, setCopied] = React.useState(false)
  const [previewIndex, setPreviewIndex] = React.useState<number | null>(null)
  const [zipping, setZipping] = React.useState(false)

  React.useEffect(() => {
    if (previewIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewIndex(null)
      if (e.key === 'ArrowLeft') setPreviewIndex((i) => (i === null ? null : Math.max(0, i - 1)))
      if (e.key === 'ArrowRight') setPreviewIndex((i) => (i === null ? null : Math.min(images.length - 1, i + 1)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewIndex, images.length])

  React.useEffect(() => {
    const b = BUILTIN_BACKGROUNDS.find((x) => x.id === bgId)
    if (b) {
      setTitleColor(b.fg)
      setBodyColor(b.sub)
      setAccentColor(b.accent)
    } else {
      setTitleColor('#111827')
      setBodyColor('#374151')
      setAccentColor('#e11d48')
    }
  }, [bgId])

  if (!open) return null

  const resolveTextConfig = async () => {
    let key = textApiKey
    let base = textApiBaseUrl
    let model = selectedTextModel
    if (!key || !base) {
      try {
        const r = await fetch('http://localhost:7866/api/local/model-config?group=chat')
        if (r.ok) {
          const c = await r.json()
          key = c.apiKey || key
          base = c.baseUrl || base
          model = c.model || model
        }
      } catch { /* ignore */ }
    }
    return { key, base, model }
  }

  const buildType = (): NoteTypography => ({
    font: FONT_OPTIONS.find((f) => f.id === fontId)?.value || FONT,
    titleSize,
    bodySize,
    titleWeight: 800,
    bodyWeight: 400,
    titleColor,
    bodyColor,
    accentColor,
  })

  const applyTypography = async () => {
    if (!data || busy) return
    setBusy(true)
    setError('')
    try {
      const style = NOTE_STYLES[0]
      const bg = BUILTIN_BACKGROUNDS.find((b) => b.id === bgId) || null
      const rendered = await renderAll(data, style, bg, buildType(), accountName)
      setImages(rendered)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '应用排版失败')
    } finally {
      setBusy(false)
    }
  }

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('先把文章或主题贴进来')
      return
    }
    setBusy(true)
    setError('')
    setData(null)
    setImages([])
    setPreviewIndex(null)
    try {
      const cfg = await resolveTextConfig()
      if (!cfg.key || !cfg.base) {
        throw new Error('请先在 Easel 设置 → 模型配置 → 对话通道填写文本模型 Key 和 Base URL')
      }
      const style = NOTE_STYLES[0]
      const bg = BUILTIN_BACKGROUNDS.find((b) => b.id === bgId) || null
      const next = await generateNoteCards(cfg.base, cfg.key, cfg.model, {
        topic: topic.trim(),
        count,
        style: `${style.name}${bg ? `，底图：${bg.name}` : ''}`,
      })
      const rendered = await renderAll(next, style, bg, buildType(), accountName)
      setData(next)
      setImages(rendered)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setBusy(false)
    }
  }

  const download = (item: RenderedCard) => {
    const a = document.createElement('a')
    a.href = item.src
    a.download = `小红书图文-${item.label}-${Date.now()}.png`
    a.click()
  }

  const downloadAll = async () => {
    if (!images.length || zipping) return
    setZipping(true)
    setError('')
    try {
      const zip = new JSZip()
      for (let i = 0; i < images.length; i++) {
        const item = images[i]
        const res = await fetch(item.src)
        const blob = await res.blob()
        const label = item.label.replace(/[\\/:*?"<>|\s]+/g, '-')
        zip.file(`${String(i + 1).padStart(2, '0')}-${label}.png`, blob)
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
      const url = URL.createObjectURL(blob)
      const safeName = (accountName.trim() || '图文卡片').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 24)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeName}-${Date.now()}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '打包下载失败')
    } finally {
      setZipping(false)
    }
  }

  const copyText = async () => {
    if (!data) return
    try {
      await navigator.clipboard.writeText(noteToText(data, accountName))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('复制失败，请手动选中文案复制')
    }
  }

  const bg = BUILTIN_BACKGROUNDS.find((b) => b.id === bgId) || null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-app-border bg-app-bg shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-app-border px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-app-text">
              <LayoutGrid size={18} className="text-blue-500" />
              图文生成
              <span className="rounded bg-orange-50 px-1.5 py-0.5 text-2xs font-medium text-orange-600 dark:bg-orange-900/20 dark:text-orange-300">小红书 3:4</span>
            </h2>
            <p className="mt-1 text-xs text-app-text-muted">文章/主题 → 封面 + 多张 1080×1440 图文卡片，文案和图片一起生成</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-app-text-muted hover:bg-app-bg-hover hover:text-app-text" title="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-app-text">
                <Sparkles size={13} className="text-blue-500" />
                文章 / 主题
                <span className="text-red-500">*</span>
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={8}
                placeholder="把文章、口播稿或主题贴进来。AI 会拆成封面 + 多张卡片，并生成配套文案。"
                className="w-full resize-none rounded-lg border border-app-border bg-app-bg-alt px-3 py-2.5 text-sm text-app-text placeholder:text-app-text-muted focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-app-text">卡片数量</label>
                <div className="flex gap-1.5">
                  {[4, 6, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCount(n)}
                      className={`flex-1 rounded-md border py-1.5 text-xs transition-colors ${count === n ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300' : 'border-app-border text-app-text-secondary hover:bg-app-bg-hover'}`}
                    >
                      {n} 张
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-2xs text-app-text-muted">不含封面，实际会多 1 张封面。</p>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-app-text">博主账号名称</span>
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="如：王姐说宽带"
                  className="w-full rounded-md border border-app-border bg-app-bg px-2.5 py-1.5 text-xs text-app-text placeholder:text-app-text-muted focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <span className="text-2xs text-app-text-muted">显示在每张卡片顶部 · @账号名</span>
              </label>
              <div className="rounded-lg border border-app-border bg-app-bg p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-app-text">排版</span>
                  {data && (
                    <button type="button" onClick={applyTypography} disabled={busy} className="rounded-md bg-blue-600 px-2 py-0.5 text-2xs font-medium text-white hover:bg-blue-700 disabled:opacity-40">
                      {busy ? '应用中…' : '应用'}
                    </button>
                  )}
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-2xs text-app-text-muted">字体</span>
                  <select value={fontId} onChange={(e) => setFontId(e.target.value)} className="rounded-md border border-app-border bg-app-bg-alt px-2 py-1.5 text-xs text-app-text focus:border-blue-500 focus:outline-none">
                    {FONT_OPTIONS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="flex justify-between text-2xs text-app-text-muted"><span>标题字号</span><b className="text-app-text">{titleSize}px</b></span>
                  <input type="range" min={48} max={130} step={2} value={titleSize} onChange={(e) => setTitleSize(Number(e.target.value))} className="note-range" style={{ '--range-progress': `${((titleSize - 48) / (130 - 48)) * 100}%` } as React.CSSProperties} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="flex justify-between text-2xs text-app-text-muted"><span>正文字号</span><b className="text-app-text">{bodySize}px</b></span>
                  <input type="range" min={24} max={48} step={1} value={bodySize} onChange={(e) => setBodySize(Number(e.target.value))} className="note-range" style={{ '--range-progress': `${((bodySize - 24) / (48 - 24)) * 100}%` } as React.CSSProperties} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span className="text-2xs text-app-text-muted">文字颜色</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const b = BUILTIN_BACKGROUNDS.find((x) => x.id === bgId)
                        if (b) {
                          setTitleColor(b.fg); setBodyColor(b.sub); setAccentColor(b.accent)
                        } else {
                          setTitleColor('#111827'); setBodyColor('#374151'); setAccentColor('#e11d48')
                        }
                      }}
                      className="text-2xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      自动
                    </button>
                    <input
                      type="color"
                      value={titleColor}
                      onChange={(e) => { setTitleColor(e.target.value); setBodyColor(e.target.value) }}
                      className="h-7 w-12 cursor-pointer rounded border border-app-border bg-transparent p-0.5"
                    />
                  </div>
                </label>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-app-text">内置底图素材</label>
                <div className="grid max-h-80 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setBgId('')}
                    className={`flex aspect-[3/4] items-center justify-center rounded-md border text-2xs transition-colors ${bgId === '' ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300' : 'border-app-border text-app-text-muted hover:bg-app-bg-hover'}`}
                  >
                    无底图
                  </button>
                  {BUILTIN_BACKGROUNDS.map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setBgId(bg.id)}
                      className={`relative aspect-[3/4] overflow-hidden rounded-md border transition-colors ${bgId === bg.id ? 'border-blue-500 ring-2 ring-blue-500/40' : 'border-app-border hover:border-blue-300'}`}
                      title={bg.desc}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={bg.src} alt={bg.name} className="h-full w-full object-cover" />
                      <span className="pointer-events-none absolute left-1 top-1 max-w-[80%] text-[7px] font-bold leading-tight drop-shadow" style={{ color: bg.fg }}>标题示例</span>
                      <span className="absolute inset-x-0 bottom-0 bg-black/55 px-0.5 py-0.5 text-[9px] font-medium leading-tight text-white">{bg.name}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-2xs text-app-text-muted">底图会覆盖卡片风格配色，文字自动适配。</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {images.length > 0 && data && (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong className="text-sm text-app-text">{data.title}</strong>
                  <p className="mt-0.5 text-2xs text-app-text-muted">封面 + {data.cards.length} 张内容卡 · 1080×1440 · {bg ? bg.name : '无底图'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={copyText} className="flex items-center gap-1.5 rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text-secondary hover:bg-app-bg-hover">
                    {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                    {copied ? '已复制' : '复制文案'}
                  </button>
                  <button type="button" onClick={downloadAll} disabled={zipping} className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    <Download size={13} /> {zipping ? '打包中...' : '下载全部 ZIP'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {images.map((item, idx) => (
                  <div key={item.id} className="group overflow-hidden rounded-xl border border-app-border bg-app-bg-alt">
                    <div className="relative cursor-zoom-in" onClick={() => setPreviewIndex(idx)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.src} alt={item.label} className="aspect-[3/4] w-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); download(item) }}
                        className="absolute right-1.5 top-1.5 rounded-md bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        title={`下载${item.label}`}
                      >
                        <Download size={13} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1.5 text-2xs text-app-text-muted">
                      <span>{item.label}</span>
                      <ImageIcon size={12} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-2xs text-app-text-muted">图片在浏览器本地绘制，不上传服务器；下载后可发小红书/公众号。</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-app-border px-5 py-3">
          <span className="text-2xs text-app-text-muted">3:4 · 1080×1440 · 文案由文本模型生成</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy || !topic.trim()}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {busy ? '生成中...' : images.length ? '重新生成' : '生成图文'}
            </button>
            <button type="button" onClick={onClose} className="rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text-secondary hover:bg-app-bg-hover">关闭</button>
          </div>
        </div>
      </div>

      {previewIndex !== null && images[previewIndex] && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewIndex(null)}>
          <button type="button" onClick={() => setPreviewIndex(null)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" title="关闭">
            <X size={20} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setPreviewIndex(Math.max(0, previewIndex - 1)) }}
            disabled={previewIndex <= 0}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 disabled:opacity-20"
            title="上一张"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex max-h-full max-w-full flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[previewIndex].src}
              alt={images[previewIndex].label}
              className="rounded-lg object-contain shadow-2xl"
              style={{ maxHeight: '82vh', maxWidth: '92vw' }}
            />
            <div className="mt-3 flex items-center gap-3 text-xs text-white/80">
              <span>{images[previewIndex].label} · {previewIndex + 1} / {images.length}</span>
              <button type="button" onClick={() => download(images[previewIndex])} className="flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 text-white hover:bg-white/20">
                <Download size={13} /> 下载这张
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setPreviewIndex(Math.min(images.length - 1, previewIndex + 1)) }}
            disabled={previewIndex >= images.length - 1}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 disabled:opacity-20"
            title="下一张"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </div>
  )
}
