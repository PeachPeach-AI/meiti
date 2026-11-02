'use client'

import React, { useCallback, useRef } from 'react'
import { useAppStore } from '@/store'
import {
  Sparkles, Image, Move, Search, FileText,
  ImageIcon, Download, Copy, UserRound, LayoutGrid,
} from 'lucide-react'
import type { CreationMode } from '@/types'
import { MODE_LABELS, STYLE_DIRECTIONS } from '@/types'
import { useImageGeneration } from '@/hooks/useImageGeneration'
import { parseXlsxFile, fileToBase64, downscaleDataUrl } from '@/lib/utils'
import { associatePrompt, expandPrompt } from '@/lib/api'
import { ImagePreviewModal } from '@/components/ui/ImagePreviewModal'
import { CoverDesignModal } from '@/components/creator/CoverDesignModal'
import { NoteDesignModal } from '@/components/creator/NoteDesignModal'

const MODES: { mode: CreationMode; icon: React.ReactNode }[] = [
  { mode: 'text2img', icon: <Sparkles size={14} /> },
  { mode: 'img2img', icon: <Image size={14} /> },
  { mode: 'fusion', icon: <Move size={14} /> },
  { mode: 'extract', icon: <Search size={14} /> },
]

function QueuePopover() {
  const taskQueue = useAppStore((s) => s.taskQueue)
  const success = taskQueue.filter((t) => t.status === 'success').length
  const failed = taskQueue.filter((t) => t.status === 'failed').length
  const waiting = taskQueue.filter((t) => t.status === 'queued').length
  const running = taskQueue.filter((t) => t.status === 'running').length

  return (
    <div className="absolute bottom-full right-0 mb-2 w-52 rounded-lg border border-app-border bg-app-bg shadow-xl p-3 z-50">
      <strong className="text-xs">当前任务概览</strong>
      <p className="text-2xs text-app-text-muted mt-0.5 mb-2">任务入队后可继续提交，结果会自动回到历史。</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <span className="text-app-text-muted">成功</span>
        <b className="text-right text-green-600">{success}</b>
        <span className="text-app-text-muted">失败</span>
        <b className="text-right text-red-500">{failed}</b>
        <span className="text-app-text-muted">待生成</span>
        <b className="text-right text-app-text-secondary">{waiting}</b>
        <span className="text-app-text-muted">生成中</span>
        <b className="text-right text-blue-500">{running}</b>
      </div>
    </div>
  )
}

export function CreatorPanel() {
  const {
    activeMode, setActiveMode,
    prompt, setPrompt,
    imageApiKey, imageApiBaseUrl,
    textApiKey, textApiBaseUrl,
    selectedTextModel,
    selectedImageModel,
    taskQueue,
    quality,
    selectedSize,
    customWidth,
    customHeight,
    ossEndpoint, ossAccessKey, ossSecretKey, ossBucket, ossRegion, ossCdnDomain,
    referenceImages, setReferenceImages,
    addHistoryItems,
  } = useAppStore()

  const { submitGeneration } = useImageGeneration()

  const ossConfig = React.useMemo(() => {
    if (!ossEndpoint || !ossAccessKey || !ossSecretKey || !ossBucket) return undefined
    return { ossEndpoint, ossAccessKey, ossSecretKey, ossBucket, ossRegion, ossCdnDomain }
  }, [ossEndpoint, ossAccessKey, ossSecretKey, ossBucket, ossRegion, ossCdnDomain])

  const [showQueue, setShowQueue] = React.useState(false)
  const [batchOpen, setBatchOpen] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)
  const [selectedStyle, setSelectedStyle] = React.useState<string | null>(null)
  const [styleBusy, setStyleBusy] = React.useState<string | null>(null)
  const [expandingPrompt, setExpandingPrompt] = React.useState(false)
  const [canvasImage, setCanvasImage] = React.useState<string | null>(null)
  const [previewImage, setPreviewImage] = React.useState<string | null>(null)
  const [previewMeta, setPreviewMeta] = React.useState<{ prompt: string; model: string; size: string; quality: string; mode: string } | null>(null)
  const [coverOpen, setCoverOpen] = React.useState(false)
  const [noteOpen, setNoteOpen] = React.useState(false)
  const imageInputRef = React.useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Monitor task queue for newest result
  React.useEffect(() => {
    const latest = taskQueue.find((t) => t.status === 'success')
    if (latest?.resultImages?.[0]) {
      setCanvasImage(latest.resultImages[0])
    }
  }, [taskQueue])

  const [extractingPrompt, setExtractingPrompt] = React.useState(false)

  const handleExtract = async () => {
    const source = referenceImages[0]
    if (!source) {
      alert('请先上传图片')
      return
    }
    if (extractingPrompt) return
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
    if (!key || !base) {
      alert('请先在 Easel 设置 → 模型配置 → 对话通道填写文本模型 Key 和 Base URL')
      return
    }
    setExtractingPrompt(true)
    try {
      const { extractPromptFromImage } = await import('@/lib/api')
      const extracted = await extractPromptFromImage(base, key, model, source)
      if (extracted) {
        setPrompt(extracted)
      } else {
        alert('图片解析返回空结果')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '提取失败'
      alert(msg)
    } finally {
      setExtractingPrompt(false)
    }
  }

  const handleModeChange = (mode: CreationMode) => {
    if (mode === activeMode) return
    setActiveMode(mode)
  }

  const handleGenerate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (activeMode === 'extract') {
      await handleExtract()
      return
    }
    const currentImage = referenceImages[0] || null
    const hasInput = prompt.trim() || (currentImage && (activeMode === 'img2img' || activeMode === 'fusion'))
    if (!imageApiKey || !imageApiBaseUrl || !hasInput || generating) return
    setGenerating(true)
    try {
      await submitGeneration(currentImage)
    } finally {
      setGenerating(false)
    }
  }, [imageApiKey, imageApiBaseUrl, prompt, generating, submitGeneration, referenceImages, activeMode, textApiKey, textApiBaseUrl, selectedTextModel])

  const applyStyleFallback = (direction: string) => {
    const trimmed = prompt.trim()
    if (!trimmed) {
      setPrompt(`${direction}风格`)
      return
    }
    if (!trimmed.includes(direction)) {
      setPrompt(`${trimmed}，${direction}风格`)
    }
  }

  const handleStyleClick = async (direction: string) => {
    setSelectedStyle(direction)

    if (!textApiKey || !textApiBaseUrl || !prompt.trim()) {
      applyStyleFallback(direction)
      return
    }

    setStyleBusy(direction)
    try {
      const newPrompt = await associatePrompt(textApiBaseUrl, textApiKey, selectedTextModel, prompt, direction)
      setPrompt(newPrompt)
    } catch {
      applyStyleFallback(direction)
    } finally {
      setStyleBusy(null)
    }
  }

  const handlePromptExpand = async () => {
    if (!prompt.trim() || expandingPrompt) return

    if (!textApiKey || !textApiBaseUrl) {
      applyStyleFallback('详细')
      return
    }

    setExpandingPrompt(true)
    try {
      const newPrompt = await expandPrompt(textApiBaseUrl, textApiKey, selectedTextModel, prompt)
      setPrompt(newPrompt)
    } catch {
      applyStyleFallback('详细')
    } finally {
      setExpandingPrompt(false)
    }
  }
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const prompts = await parseXlsxFile(file)
      // Set first prompt and notify user
      if (prompts.length > 0) {
        setPrompt(prompts[0])
      }
    } catch {
      // ignore
    }
  }

  const runningTask = taskQueue.find((t) => t.status === 'running')
  const latestTask = taskQueue.find((t) => t.status === 'success')
  const latestFailed = taskQueue.find((t) => t.status === 'failed')

  const handleCopyCanvas = async () => {
    if (!canvasImage) return
    try {
      const parts = canvasImage.split(',')
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
      const binary = atob(parts[1])
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: mime })
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    } catch {
      await navigator.clipboard.writeText(canvasImage)
    }
  }

  const handleSlicesReady = useCallback((slices: string[]) => {
    const meta = previewMeta
    if (!meta) return
    const ts = Date.now()
    const items = slices.map((src, idx) => ({
      id: `${ts}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      mode: meta.mode as CreationMode,
      prompt: `${meta.prompt} - 裁切 ${idx + 1}/${slices.length}`,
      model: meta.model,
      size: meta.size,
      quality: meta.quality,
      images: [src],
      duration: 0,
      createdAt: ts,
    }))
    addHistoryItems(items)
  }, [previewMeta, addHistoryItems])

  return (
    <section className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Canvas Area */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 p-4 relative overflow-auto">
        {canvasImage ? (
          <div className="relative group max-w-full max-h-full">
            <img
              src={canvasImage}
              alt="生成结果"
              onClick={() => {
                setPreviewImage(canvasImage)
                const task = taskQueue.find((t) => t.status === 'success')
                setPreviewMeta({
                  prompt: task?.prompt || prompt,
                  model: task?.model || selectedImageModel,
                  size: task?.size || `${selectedSize.preset === 'custom' ? `${customWidth}x${customHeight}` : `${selectedSize.width}x${selectedSize.height}`}`,
                  quality: task?.quality || quality,
                  mode: task?.mode || activeMode,
                })
              }}
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg cursor-zoom-in"
            />
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={handleCopyCanvas}
                className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70"
                title="复制图片"
              >
                <Copy size={16} />
              </button>
              <a
                href={canvasImage}
                download={`image2-${Date.now()}.png`}
                className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70"
              >
                <Download size={16} />
              </a>
            </div>
          </div>
        ) : runningTask ? (
          <div className="flex flex-col items-center gap-3 text-app-text-muted">
            <div className="animate-spin">
              <Sparkles size={32} />
            </div>
            <strong className="text-sm">生成中...</strong>
            <span className="text-xs">带参考图或高分辨率时可能需要 1–3 分钟，请勿重复提交</span>
          </div>
        ) : latestFailed ? (
          <div className="flex flex-col items-center gap-3 text-center max-w-md p-6 rounded-xl border-2 border-red-500/40 bg-red-50 dark:bg-red-950/20">
            <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-white text-xl font-bold">!</span>
            </div>
            <strong className="text-base text-red-600 dark:text-red-400">生成失败</strong>
            <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed break-all whitespace-pre-wrap">{latestFailed.error}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <ImageIcon size={36} className="text-app-text-muted" />
            <strong className="text-sm text-app-text-secondary">写好提示词后，图片会优先显示在这里</strong>
            <span className="text-xs text-app-text-muted">左侧调参数，底部输入，右侧看历史</span>
          </div>
        )}
      </div>

      {/* Mode Tabs */}
      <div className="flex shrink-0 items-center gap-1 px-3 py-1.5 border-t border-app-border overflow-x-auto">
        <div className="flex gap-0.5" role="tablist" aria-label="创作模式">
          {MODES.map(({ mode, icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleModeChange(mode)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                activeMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'text-app-text-secondary hover:bg-app-bg-hover'
              }`}
            >
              {icon}
              <span>{MODE_LABELS[mode]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5" aria-label="辅助工具">
          <button
            type="button"
            onClick={() => setCoverOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs whitespace-nowrap text-app-text-secondary hover:bg-app-bg-hover hover:text-app-text transition-colors"
            title="3:4 口播封面提示词（gbro-cover-design）"
          >
            <UserRound size={14} />
            口播封面
          </button>
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs whitespace-nowrap text-app-text-secondary hover:bg-app-bg-hover hover:text-app-text transition-colors"
            title="文章/主题生成 3:4 小红书图文卡片"
          >
            <LayoutGrid size={14} />
            图文生成
          </button>
          <button
            type="button"
            onClick={handlePromptExpand}
            disabled={!prompt.trim() || expandingPrompt}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs whitespace-nowrap text-app-text-secondary hover:bg-app-bg-hover hover:text-app-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="调用文本模型联想并扩写当前提示词"
          >
            <Sparkles size={14} />
            {expandingPrompt ? '联想中...' : '提示词联想'}
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('document')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
              activeMode === 'document'
                ? 'bg-blue-600 text-white'
                : 'text-app-text-secondary hover:bg-app-bg-hover'
            }`}
          >
            <FileText size={14} />
            <span>{MODE_LABELS.document}</span>
          </button>
        </div>
      </div>

      {/* Style Rail */}
      {activeMode === 'text2img' && (
        <div className="flex gap-1 px-3 py-1.5 shrink-0 border-t border-app-border-light overflow-x-auto" aria-label="提示词类型">
          {STYLE_DIRECTIONS.map((dir) => {
            const selected = selectedStyle === dir
            const busy = styleBusy === dir
            return (
              <button
                key={dir}
                type="button"
                onClick={() => handleStyleClick(dir)}
                disabled={styleBusy !== null}
                aria-pressed={selected}
                className={`px-2.5 py-0.5 rounded text-2xs border whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-wait ${
                  selected
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'text-app-text-secondary border-app-border hover:bg-app-bg-hover hover:text-app-text'
                }`}
                title={`基于当前提示词联想成${dir}方向`}
              >
                {busy ? '联想中' : dir}
              </button>
            )
          })}
        </div>
      )}

      {/* Composer Body */}
      <form onSubmit={handleGenerate} className="shrink-0 border-t border-app-border p-3 space-y-2">
        {/* Image upload for img2img / fusion / extract */}
        {(activeMode === 'img2img' || activeMode === 'fusion' || activeMode === 'extract') && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-app-border text-xs text-app-text-secondary hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors">
                <Image size={14} />
                {activeMode === 'fusion' ? '上传多张图片' : '上传图片'}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple={activeMode === 'fusion'}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const raw = await fileToBase64(file)
                      const src = await downscaleDataUrl(raw)
                      setReferenceImages([src])
                    }
                  }}
                />
              </label>
              <span className="text-2xs text-app-text-muted">
                {activeMode === 'fusion' ? '可多选 2-4 张' : activeMode === 'extract' ? '提取图片描述' : '参考图会随请求提交给模型'}
              </span>
            </div>
            {referenceImages.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {referenceImages.map((img, idx) => (
                  <div key={`${idx}-${img.slice(-16)}`} className="relative inline-block">
                    <img src={img} alt={`参考图 ${idx + 1}`} className="h-16 rounded border border-app-border object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setReferenceImages(referenceImages.filter((_, i) => i !== idx))
                        if (referenceImages.length <= 1 && imageInputRef.current) imageInputRef.current.value = ''
                      }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-xs"
                    >x</button>
                  </div>
                ))}
              </div>
            )}
            {referenceImages.length > 0 && (
              <p className="text-2xs text-green-600 dark:text-green-400">
                {activeMode === 'extract'
                  ? '已选图片，生成时将调用文本模型解析为提示词'
                  : '已选参考图，会随生图请求一起提交（模型支持参考图时才会生效）'}
              </p>
            )}
          </div>
        )}

        {/* Document upload */}
        {activeMode === 'document' && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-app-border text-xs text-app-text-secondary hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors">
              <FileText size={14} />
              上传文档 (PDF/TXT/MD)
              <input type="file" accept=".pdf,.txt,.md,.csv,.xlsx" className="hidden" />
            </label>
            <span className="text-2xs text-app-text-muted">解析内容后生成配图</span>
          </div>
        )}

        {/* Prompt Textarea */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-app-text-secondary">提示词</span>
          <textarea
            maxLength={2000}
            placeholder="描述你想生成的图像内容、风格、构图、光线、色彩等细节..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-app-border bg-transparent px-3 py-2 text-sm resize-none placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
          <small className="text-2xs text-app-text-muted text-right">{prompt.length} / 2000</small>
        </label>

        {/* Batch Import */}
        <div className="border-t border-app-border-light pt-2">
          <button
            type="button"
            onClick={() => setBatchOpen(!batchOpen)}
            className="flex items-center gap-1.5 text-xs text-app-text-secondary hover:text-app-text"
          >
            <FileText size={14} />
            <span>提示词导入生成</span>
          </button>
          {batchOpen && (
            <div className="flex items-center gap-2 mt-2">
              <button type="button" className="px-2 py-1 rounded text-2xs border border-app-border text-app-text-secondary hover:bg-app-bg-hover">
                模板
              </button>
              <label className="px-2 py-1 rounded text-2xs border border-app-border text-app-text-secondary hover:bg-app-bg-hover cursor-pointer">
                上传 Excel/CSV
                <input
                  ref={fileInputRef}
                  accept=".xlsx,.csv"
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          )}
        </div>

        {/* Generate Button + Queue Summary */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={
              activeMode === 'extract'
                ? referenceImages.length === 0 || extractingPrompt
                : !imageApiKey || !imageApiBaseUrl || (!prompt.trim() && referenceImages.length === 0) || generating
            }
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles size={17} />
            {activeMode === 'extract'
              ? (extractingPrompt ? '提取中...' : '提取提示词')
              : (generating ? '生成中...' : '立即生成')
            }
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowQueue(!showQueue)}
              className="text-xs text-app-text-muted hover:text-app-text-secondary"
            >
              任务概览
            </button>
            {showQueue && <QueuePopover />}
          </div>
        </div>
      </form>

      <ImagePreviewModal
        src={previewImage || ''}
        open={!!previewImage}
        onClose={() => { setPreviewImage(null); setPreviewMeta(null) }}
        onSlicesReady={handleSlicesReady}
        ossConfig={ossConfig}
      />
      <CoverDesignModal open={coverOpen} onClose={() => setCoverOpen(false)} />
      <NoteDesignModal open={noteOpen} onClose={() => setNoteOpen(false)} />
    </section>
  )
}












