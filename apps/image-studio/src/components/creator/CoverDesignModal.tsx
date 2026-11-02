'use client'

import React from 'react'
import { useAppStore } from '@/store'
import { generateCoverPrompt } from '@/lib/api'
import { fileToBase64, downscaleDataUrl } from '@/lib/utils'
import {
  X, Sparkles, Upload, Copy, Check, ArrowLeft, ArrowRight,
  UserRound, Palette, Type, LayoutTemplate, Image as ImageIcon,
  WandSparkles, AlertCircle,
} from 'lucide-react'

const COVER_STYLES = [
  { id: 'auto', name: '让 AI 推荐', desc: '根据口播内容自动选最合适的风格' },
  { id: '深色渐变风', name: '深色渐变风', desc: '人物居中，大字压在后面，冲击力最强' },
  { id: '纯色扁平风', name: '纯色扁平风', desc: '人物 + 道具 + 纯色背景，干净清爽' },
  { id: '产品主视觉风', name: '产品主视觉风', desc: '有 UI 截图或产品图时，截图占主体' },
  { id: '对比卡片风', name: '对比卡片风', desc: '前后对比、好坏对比类内容专用' },
  { id: '极简留白风', name: '极简留白风', desc: '大留白，标题是唯一焦点' },
  { id: '海报拼贴风', name: '海报拼贴风', desc: '素材多时多层叠加，纵深感强' },
  { id: '人物侧置留白风', name: '人物侧置留白风', desc: '人物偏一侧，另一边全给标题' },
  { id: '背影构图风', name: '背影构图风', desc: '人物背对镜头，适合励志、启发类' },
  { id: '局部出镜风', name: '局部出镜风', desc: '只露手或半张脸，产品是绝对主角' },
  { id: '正面对视风', name: '正面对视风', desc: '直视镜头，眼神接触，情绪直接' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function CoverDesignModal({ open, onClose }: Props) {
  const {
    textApiKey, textApiBaseUrl, selectedTextModel,
    setPrompt, setSelectedSize, setActiveMode, setReferenceImages,
  } = useAppStore()

  const [step, setStep] = React.useState(1)
  const [brief, setBrief] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [style, setStyle] = React.useState('auto')
  const [face, setFace] = React.useState<string | null>(null)
  const [faceName, setFaceName] = React.useState('')
  const [bgImage, setBgImage] = React.useState<string | null>(null)
  const [bgName, setBgName] = React.useState('')
  const [expression, setExpression] = React.useState('')
  const [background, setBackground] = React.useState('')
  const [font, setFont] = React.useState('')
  const [color, setColor] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState('')
  const [error, setError] = React.useState('')
  const [copied, setCopied] = React.useState(false)
  const [applied, setApplied] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setCopied(false)
    setApplied(false)
  }, [open])

  if (!open) return null

  const canNext = !!brief.trim() || !!title.trim()

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

  const handleFace = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 12 * 1024 * 1024) {
      setError('人脸参考图请小于 12MB')
      return
    }
    setError('')
    try {
      const raw = await fileToBase64(file)
      setFace(await downscaleDataUrl(raw))
      setFaceName(file.name)
    } catch {
      setError('人脸参考图读取失败，请换一张')
    }
  }

  const handleBackground = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 12 * 1024 * 1024) {
      setError('背景参考图请小于 12MB')
      return
    }
    setError('')
    try {
      const raw = await fileToBase64(file)
      setBgImage(await downscaleDataUrl(raw))
      setBgName(file.name)
    } catch {
      setError('背景参考图读取失败，请换一张')
    }
  }

  const handleGenerate = async () => {
    if (!canNext) {
      setError('先填口播稿或标题')
      return
    }
    setBusy(true)
    setError('')
    try {
      const cfg = await resolveTextConfig()
      if (!cfg.key || !cfg.base) {
        throw new Error('请先在 Easel 设置 → 模型配置 → 对话通道填写文本模型 Key 和 Base URL')
      }
      const p = await generateCoverPrompt(cfg.base, cfg.key, cfg.model, {
        brief: brief.trim(),
        title: title.trim(),
        style,
        face,
        backgroundImage: bgImage,
        expression: expression.trim(),
        background: background.trim(),
        font: font.trim(),
        color: color.trim(),
      })
      setResult(p)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('复制失败，请手动选中提示词复制')
    }
  }

  const handleApply = () => {
    if (!result) return
    setPrompt(result)
    setSelectedSize({ preset: '1080x1440', width: 1080, height: 1440 })
    setActiveMode('img2img')
    setReferenceImages([face, bgImage].filter(Boolean) as string[])
    setApplied(true)
    setTimeout(onClose, 600)
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-app-border bg-app-bg shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-app-border px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-app-text">
              <WandSparkles size={18} className="text-blue-500" />
              口播封面
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-2xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">gbro-cover-design</span>
            </h2>
            <p className="mt-1 text-xs text-app-text-muted">3:4 竖版 · 真人出镜 · 10 种构图 · 三轮提问生成封面提示词</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-app-text-muted hover:bg-app-bg-hover hover:text-app-text" title="关闭">
            <X size={18} />
          </button>
        </div>

        {/* Steps */}
        <div className="flex shrink-0 items-center gap-2 border-b border-app-border px-5 py-2.5 text-xs">
          {[
            { n: 1, label: '内容' },
            { n: 2, label: '构图' },
            { n: 3, label: '细节' },
          ].map((s) => (
            <React.Fragment key={s.n}>
              <button
                type="button"
                onClick={() => { if (s.n < step) setStep(s.n) }}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors ${step === s.n ? 'bg-blue-600 text-white' : step > s.n ? 'text-blue-600 dark:text-blue-300' : 'text-app-text-muted'}`}
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-2xs ${step === s.n ? 'bg-white/20' : step > s.n ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-app-bg-alt'}`}>{s.n}</span>
                {s.label}
              </button>
              {s.n < 3 && <span className="text-app-text-muted">›</span>}
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-app-text">
                  <Sparkles size={13} className="text-blue-500" />
                  口播稿 / 主题
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={6}
                  placeholder="把这条口播的稿子或核心主题贴进来，例如：花千兆的钱，为什么家里网还是卡？三个最常见原因……"
                  className="w-full resize-none rounded-lg border border-app-border bg-app-bg-alt px-3 py-2.5 text-sm text-app-text placeholder:text-app-text-muted focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <p className="mt-1 text-2xs text-app-text-muted">AI 会据此拟标题、选构图风格和生成封面提示词。</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-app-text">标题（可选）</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="不填就让 AI 拟一个 8-14 字的强钩子标题"
                  className="w-full rounded-lg border border-app-border bg-app-bg-alt px-3 py-2 text-sm text-app-text placeholder:text-app-text-muted focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-app-text">
                  <LayoutTemplate size={13} className="text-blue-500" />
                  构图风格
                </label>
                <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {COVER_STYLES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyle(s.id)}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${style === s.id ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'border-app-border hover:border-blue-300 hover:bg-app-bg-hover'}`}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        {s.id === 'auto' && <WandSparkles size={12} />}
                        {s.name}
                      </span>
                      <span className="mt-0.5 block text-2xs leading-relaxed text-app-text-muted">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-app-text">
                  <UserRound size={13} className="text-blue-500" />
                  人脸参考图（建议上传）
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-app-border px-3 py-2 text-xs text-app-text-secondary transition-colors hover:border-blue-400 hover:text-blue-600">
                    <Upload size={14} />
                    上传正脸照
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFace(e.target.files?.[0])} />
                  </label>
                  {face && (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={face} alt="人脸参考" className="h-14 w-14 rounded-lg border border-app-border object-cover" />
                      <div className="text-2xs text-app-text-muted">
                        <div className="max-w-[160px] truncate">{faceName || '已上传'}</div>
                        <button type="button" onClick={() => { setFace(null); setFaceName('') }} className="text-red-500 hover:text-red-600">移除</button>
                      </div>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-2xs text-app-text-muted">上传后会作为参考图随请求发给支持参考图的生图模型（如 Seedream / 即梦），人脸一致性更高。</p>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-app-text">
                  <ImageIcon size={13} className="text-blue-500" />
                  底图背景参考（可选）
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-app-border px-3 py-2 text-xs text-app-text-secondary transition-colors hover:border-blue-400 hover:text-blue-600">
                    <Upload size={14} />
                    上传背景图
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBackground(e.target.files?.[0])} />
                  </label>
                  {bgImage && (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={bgImage} alt="背景参考" className="h-14 w-14 rounded-lg border border-app-border object-cover" />
                      <div className="text-2xs text-app-text-muted">
                        <div className="max-w-[160px] truncate">{bgName || '已上传'}</div>
                        <button type="button" onClick={() => { setBgImage(null); setBgName('') }} className="text-red-500 hover:text-red-600">移除</button>
                      </div>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-2xs text-app-text-muted">传一张你想要的底图（手账、便签、纯色都可以），会沿用它的配色与材质，不照抄上面的文字和水印。</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-app-text">
                    <UserRound size={13} className="text-blue-500" />
                    表情
                  </label>
                  <input value={expression} onChange={(e) => setExpression(e.target.value)} placeholder="如：认真、疑惑、笑着提醒" className="w-full rounded-lg border border-app-border bg-app-bg-alt px-3 py-2 text-sm text-app-text placeholder:text-app-text-muted focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-app-text">
                    <Palette size={13} className="text-blue-500" />
                    背景色调
                  </label>
                  <input value={background} onChange={(e) => setBackground(e.target.value)} placeholder="如：深蓝渐变、暖橙纯色" className="w-full rounded-lg border border-app-border bg-app-bg-alt px-3 py-2 text-sm text-app-text placeholder:text-app-text-muted focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-app-text">
                    <Type size={13} className="text-blue-500" />
                    字体
                  </label>
                  <input value={font} onChange={(e) => setFont(e.target.value)} placeholder="如：思源黑体 Heavy" className="w-full rounded-lg border border-app-border bg-app-bg-alt px-3 py-2 text-sm text-app-text placeholder:text-app-text-muted focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-app-text">
                    <Palette size={13} className="text-blue-500" />
                    字色
                  </label>
                  <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="如：白色 + 少量黄色强调" className="w-full rounded-lg border border-app-border bg-app-bg-alt px-3 py-2 text-sm text-app-text placeholder:text-app-text-muted focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                不填的项交给 AI 决定。生成的是 3:4（1080×1440）口播封面提示词；带入工作台后会连同上一步的正脸照一起提交生图。
              </p>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-medium text-app-text">
                  <Check size={13} className="text-green-500" />
                  生成的封面提示词
                </label>
                <span className="text-2xs text-app-text-muted">{result.length} 字</span>
              </div>
              <textarea
                value={result}
                readOnly
                rows={9}
                className="w-full resize-y rounded-lg border border-app-border bg-app-bg-alt px-3 py-2.5 text-xs leading-relaxed text-app-text focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleCopy} className="flex items-center gap-1.5 rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text-secondary hover:bg-app-bg-hover">
                  {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  {copied ? '已复制' : '复制提示词'}
                </button>
                <button type="button" onClick={handleApply} className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                  <ImageIcon size={13} />
                  带入图像工作台
                </button>
                {applied && <span className="text-2xs text-green-600 dark:text-green-400">已带入，关闭后点「立即生成」</span>}
                <button type="button" onClick={handleGenerate} disabled={busy} className="ml-auto text-2xs text-app-text-muted hover:text-blue-600 disabled:opacity-40">
                  重新生成
                </button>
              </div>
              <p className="text-2xs leading-relaxed text-app-text-muted">
                {face && bgImage
                  ? '正脸照与底图已作为参考图一起提交；模型不支持参考图时会自动退回纯文生图。'
                  : face
                    ? '正脸照已作为参考图一起提交；模型不支持参考图时会自动退回纯文生图。'
                    : bgImage
                      ? '底图已作为参考图一起提交；未上传正脸照，人物不会与本人一致。'
                      : '未上传参考图，只按提示词生成，人物不会与本人一致。'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-app-border px-5 py-3">
          <span className="text-2xs text-app-text-muted">3:4 · 1080×1440 · 口播封面</span>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button type="button" onClick={() => setStep(step - 1)} className="flex items-center gap-1 rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text-secondary hover:bg-app-bg-hover">
                <ArrowLeft size={13} /> 上一步
              </button>
            )}
            {step < 3 ? (
              <button type="button" onClick={() => setStep(step + 1)} disabled={step === 1 && !canNext} className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
                下一步 <ArrowRight size={13} />
              </button>
            ) : (
              <button type="button" onClick={handleGenerate} disabled={busy} className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
                <Sparkles size={13} />
                {busy ? '生成中...' : '生成封面提示词'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
