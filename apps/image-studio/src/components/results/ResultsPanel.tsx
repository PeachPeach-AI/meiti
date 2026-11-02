'use client'

import React, { useMemo } from 'react'
import { useAppStore } from '@/store'
import { Trash2, RefreshCw, Clock3, Search, ImageIcon, Download, Copy, Scissors, Share2, Loader2, Upload } from 'lucide-react'
import type { HistoryFilter, HistoryItem, CreationMode } from '@/types'
import { ImagePreviewModal } from '@/components/ui/ImagePreviewModal'

interface PreviewItem {
  src: string
  prompt: string
  model: string
  size: string
  quality: string
  mode: CreationMode
}

function ResultThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = React.useState(false)
  const [cached, setCached] = React.useState('')
  const effective = cached || src

  const handleError = async () => {
    if (!src.startsWith('http')) { setFailed(true); return }
    try {
      const r = await fetch('/api/cache-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: src }),
      })
      if (r.ok) {
        const j = await r.json() as { url?: string }
        if (j.url) { setCached(j.url); return }
      }
    } catch { /* fall through */ }
    setFailed(true)
  }

  if (!src || failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center">
        <ImageIcon size={18} className="text-app-text-muted" />
        <span className="text-[10px] leading-tight text-app-text-muted">{src ? '图片链接已过期' : '暂无图片'}</span>
      </div>
    )
  }
  return (
    <img
      src={effective}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={handleError}
      className="h-full w-full object-cover"
    />
  )
}

export function ResultsPanel() {
  const {
    history, clearHistory, deleteHistoryItem, addHistoryItems,
    historyFilter, setHistoryFilter,
    historySearch, setHistorySearch,
    historyPage, setHistoryPage,
    pageSize,
    taskQueue,
    ossEndpoint, ossAccessKey, ossSecretKey, ossBucket, ossRegion, ossCdnDomain,
  } = useAppStore()

  const ossConfig = React.useMemo(() => {
    if (!ossEndpoint || !ossAccessKey || !ossSecretKey || !ossBucket) return undefined
    return { ossEndpoint, ossAccessKey, ossSecretKey, ossBucket, ossRegion, ossCdnDomain }
  }, [ossEndpoint, ossAccessKey, ossSecretKey, ossBucket, ossRegion, ossCdnDomain])

  const [activeTab, setActiveTab] = React.useState<'session' | 'history'>('history')
  const [previewItem, setPreviewItem] = React.useState<PreviewItem | null>(null)
  const [previewIndex, setPreviewIndex] = React.useState(0)
  const [previewCutMode, setPreviewCutMode] = React.useState(false)
  const [sharingId, setSharingId] = React.useState<string | null>(null)
  const cutUploadRef = React.useRef<HTMLInputElement>(null)

  const handleCutUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result as string
      setPreviewItem({
        src,
        prompt: file.name,
        model: 'upload',
        size: '',
        quality: '',
        mode: 'text2img',
      })
      setPreviewCutMode(true)
      setPreviewIndex(0)
    }
    reader.readAsDataURL(file)
    if (cutUploadRef.current) cutUploadRef.current.value = ''
  }

  const handleShareImage = React.useCallback(async (e: React.MouseEvent, dataUrl: string, id: string) => {
    e.stopPropagation()
    if (!ossConfig || sharingId) return
    setSharingId(id)
    try {
      const res = await fetch('/api/oss/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-oss-endpoint': ossConfig.ossEndpoint,
          'x-oss-access-key': ossConfig.ossAccessKey,
          'x-oss-secret-key': ossConfig.ossSecretKey,
          'x-oss-bucket': ossConfig.ossBucket,
          'x-oss-region': ossConfig.ossRegion,
          'x-oss-cdn-domain': ossConfig.ossCdnDomain,
        },
        body: JSON.stringify({ image: dataUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '上传失败')
      await navigator.clipboard.writeText(data.url)
    } catch {
      // share failed silently
    } finally {
      setSharingId(null)
    }
  }, [ossConfig, sharingId])

  const handleSlicesReady = React.useCallback((slices: string[]) => {
    if (!previewItem) return
    const ts = Date.now()
    const items = slices.map((src, idx) => ({
      id: `${ts}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      mode: previewItem.mode,
      prompt: `${previewItem.prompt} - 裁切 ${idx + 1}/${slices.length}`,
      model: previewItem.model,
      size: previewItem.size,
      quality: previewItem.quality,
      images: [src],
      duration: 0,
      createdAt: ts,
    }))
    addHistoryItems(items)
  }, [previewItem, addHistoryItems])

  const handleCopyImage = async (dataUrl: string) => {
    try {
      if (dataUrl.startsWith('http')) {
        await navigator.clipboard.writeText(dataUrl)
        return
      }
      const parts = dataUrl.split(',')
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
      const binary = atob(parts[1])
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: mime })
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    } catch {
      await navigator.clipboard.writeText(dataUrl)
    }
  }

  const handleDownloadImage = async (dataUrl: string) => {
    try {
      if (dataUrl.startsWith('http')) {
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `image2-${Date.now()}.png`
        a.click()
        URL.revokeObjectURL(url)
        return
      }
    } catch { /* fall through */ }
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `image2-${Date.now()}.png`
    a.click()
  }

  // Filter and search
  const filteredHistory = useMemo(() => {
    let items = history
    if (historyFilter !== 'all') {
      items = items.filter((h) => h.mode === historyFilter)
    }
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase()
      items = items.filter(
        (h) =>
          h.prompt.toLowerCase().includes(q) ||
          h.model.toLowerCase().includes(q) ||
          h.size.toLowerCase().includes(q)
      )
    }
    return items
  }, [history, historyFilter, historySearch])

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize))
  const pagedItems = filteredHistory.slice((historyPage - 1) * pageSize, historyPage * pageSize)

  // Session results (from current task queue)
  const sessionResults = taskQueue.filter((t) => t.status === 'success')

  // Build flat list of all visible images for navigation
  const allImageItems = React.useMemo(() => {
    const sessionItems = sessionResults.map((t) => ({
      src: t.resultImages?.[0] || '',
      prompt: t.prompt,
      model: t.model,
      size: t.size,
      quality: t.quality || '',
      mode: t.mode,
      id: t.id,
    }))
    const historyItems = pagedItems.map((h) => ({
      src: h.images[0] || '',
      prompt: h.prompt,
      model: h.model,
      size: h.size,
      quality: h.quality || '',
      mode: h.mode,
      id: h.id,
    }))
    return activeTab === 'session' ? sessionItems : historyItems
  }, [sessionResults, pagedItems, activeTab])

  const openPreview = React.useCallback((item: { id: string; images: string[]; prompt: string; model: string; size: string; duration: number }, mode: CreationMode, quality: string) => {
    if (!item.images[0]) return
    const idx = allImageItems.findIndex((i) => i.id === item.id)
    setPreviewIndex(idx >= 0 ? idx : 0)
    setPreviewCutMode(false)
    setPreviewItem({
      src: item.images[0],
      prompt: item.prompt,
      model: item.model,
      size: item.size,
      quality,
      mode,
    })
  }, [allImageItems])

  const openCutPreview = React.useCallback((e: React.MouseEvent, item: { id: string; images: string[]; prompt: string; model: string; size: string; duration: number }, mode: CreationMode, quality: string) => {
    e.stopPropagation()
    if (!item.images[0]) return
    const idx = allImageItems.findIndex((i) => i.id === item.id)
    setPreviewIndex(idx >= 0 ? idx : 0)
    setPreviewCutMode(true)
    setPreviewItem({
      src: item.images[0],
      prompt: item.prompt,
      model: item.model,
      size: item.size,
      quality,
      mode,
    })
  }, [allImageItems])

  const handleNavigate = React.useCallback((index: number) => {
    const item = allImageItems[index]
    if (!item) return
    setPreviewIndex(index)
    setPreviewItem({
      src: item.src,
      prompt: item.prompt,
      model: item.model,
      size: item.size,
      quality: item.quality,
      mode: item.mode,
    })
  }, [allImageItems])

  // Average duration
  const avgDuration = useMemo(() => {
    const successes = history.filter((h) => h.duration > 0)
    if (successes.length === 0) return null
    const avg = successes.reduce((sum, h) => sum + h.duration, 0) / successes.length
    return avg
  }, [history])

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const FILTERS: { key: HistoryFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'text2img', label: '文字' },
    { key: 'img2img', label: '图生图' },
    { key: 'fusion', label: '融合' },
    { key: 'document', label: '文档' },
  ]

  const runningTask = taskQueue.find((t) => t.status === 'running')

  return (
    <aside className="flex flex-col h-full overflow-hidden">
      {/* Title */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[var(--app-border)] shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--app-text)]">历史记录</h2>
          <p className="mt-0.5 text-[11.5px] text-[var(--app-text-muted)]">生成结果与任务状态</p>
        </div>
        <span className="text-2xs text-app-text-muted" title="当前 Key 暂无可统计的成功生成耗时">
          平均 {avgDuration ? formatDuration(avgDuration) : '--'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearHistory}
            className="p-1 rounded text-app-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="清空"
          >
            <Trash2 size={12} />
          </button>
          <button
            type="button"
            disabled
            className="p-1 rounded text-app-text-muted"
            title="刷新"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Result Tabs */}
      <div className="flex shrink-0 border-b border-app-border">
        <button
          type="button"
          onClick={() => setActiveTab('session')}
          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'session'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-app-text-muted hover:text-app-text-secondary'
          }`}
        >
          本次结果
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-app-text-muted hover:text-app-text-secondary'
          }`}
        >
          <span className="flex items-center justify-center gap-1">
            <Clock3 size={12} />
            历史 {history.length}
          </span>
        </button>
      </div>

      {/* Search + Filters */}
      {activeTab === 'history' && (
        <>
          <div className="px-3 py-2 shrink-0">
            <div className="relative flex items-center">
              <input
                placeholder="搜索提示词 / 模型 / 尺寸"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full rounded-md border border-app-border bg-transparent pl-8 pr-2.5 py-1.5 text-xs placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
              />
              <Search size={14} className="absolute left-2.5 text-app-text-muted pointer-events-none" />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 px-3 pb-2 shrink-0 overflow-x-auto">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setHistoryFilter(key)}
                className={`px-2 py-0.5 rounded text-2xs whitespace-nowrap transition-colors ${
                  historyFilter === key
                    ? 'bg-blue-600 text-white'
                    : 'text-app-text-secondary hover:bg-app-bg-hover'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0 border-b border-app-border-light">
        <button
          type="button"
          disabled={historyPage <= 1}
          onClick={() => setHistoryPage(historyPage - 1)}
          className="text-2xs text-app-text-muted hover:text-app-text-secondary disabled:opacity-30 transition-colors"
        >
          上一页
        </button>
        <span className="text-2xs text-app-text-muted">本地 {filteredHistory.length} 条</span>
        <button
          type="button"
          disabled={historyPage >= totalPages}
          onClick={() => setHistoryPage(historyPage + 1)}
          className="text-2xs text-app-text-muted hover:text-app-text-secondary disabled:opacity-30 transition-colors"
        >
          下一页
        </button>
      </div>

      {/* Result Grid */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        {activeTab === 'session' && sessionResults.length === 0 && (
          <div className="flex flex-col items-center gap-2 text-center py-4">
            <ImageIcon size={28} className="text-app-text-muted" />
            <strong className="text-xs text-app-text-secondary">本次暂无结果</strong>
            <span className="text-2xs text-app-text-muted">生成完成后会显示在这里</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          {activeTab === 'history' && (
            <label className="flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-app-border hover:border-blue-400 aspect-square bg-app-bg-alt cursor-pointer transition-colors group">
              <Upload size={18} className="text-app-text-muted group-hover:text-blue-500" />
              <Scissors size={14} className="text-app-text-muted group-hover:text-blue-500" />
              <span className="text-2xs text-app-text-muted group-hover:text-blue-500">上传裁切</span>
              <input
                ref={cutUploadRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCutUpload}
              />
            </label>
          )}

          {(activeTab === 'session'
            ? sessionResults.map((t) => ({ id: t.id, images: t.resultImages || [], prompt: t.prompt, model: t.model, size: t.size, duration: t.duration || 0, quality: t.quality, mode: t.mode }))
            : pagedItems.map((h) => ({ ...h, quality: h.quality || '', mode: h.mode }))
          ).map((item) => (
            <div
              key={item.id}
              className="group relative rounded-md overflow-hidden border border-app-border aspect-square bg-app-bg-alt cursor-pointer"
              onClick={() => openPreview(item, item.mode, item.quality)}
            >
              <ResultThumb src={item.images[0] || ''} alt={item.prompt.slice(0, 50)} />
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1.5">
                <p className="text-2xs text-white/90 line-clamp-2 leading-snug">{item.prompt}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-2xs text-white/60">{item.model}</span>
                  <span className="text-2xs text-white/40">{item.size}</span>
                  {item.duration > 0 && (
                    <span className="text-2xs text-white/40">{formatDuration(item.duration)}</span>
                  )}
        </div>

        {activeTab === 'history' && pagedItems.length === 0 && (
          <div className="flex flex-col items-center gap-2 text-center py-4">
            <ImageIcon size={28} className="text-app-text-muted" />
            <strong className="text-xs text-app-text-secondary">生成结果会显示在这里</strong>
            <span className="text-2xs text-app-text-muted">先填 Key，再输入提示词开始创作</span>
          </div>
        )}
      </div>
              {/* Action buttons */}
              <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleCopyImage(item.images[0]) }}
                  className="p-0.5 rounded bg-black/60 text-white hover:bg-black/80"
                  title="复制图片"
                >
                  <Copy size={10} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDownloadImage(item.images[0]) }}
                  className="p-0.5 rounded bg-black/60 text-white hover:bg-black/80"
                  title="下载"
                >
                  <Download size={10} />
                </button>
                {ossConfig && (
                  <button
                    type="button"
                    onClick={(e) => handleShareImage(e, item.images[0], item.id)}
                    disabled={sharingId === item.id}
                    className="p-0.5 rounded bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                    title="分享"
                  >
                    {sharingId === item.id ? <Loader2 size={10} className="animate-spin" /> : <Share2 size={10} />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => openCutPreview(e, item, item.mode, item.quality)}
                  className="p-0.5 rounded bg-blue-500 text-white hover:bg-blue-600"
                  title="裁切"
                >
                  <Scissors size={10} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id) }}
                  className="p-0.5 rounded bg-red-500 text-white hover:bg-red-600"
                  title="删除"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress Card */}
      {runningTask && (
        <div className="shrink-0 mx-2 mb-2 p-2 rounded-lg border border-app-border bg-app-bg-alt">
          <div className="flex items-center gap-2">
            <div className="animate-spin text-blue-500">
              <RefreshCw size={14} />
            </div>
            <span className="text-xs text-app-text-secondary">等待创作</span>
            <div className="flex-1 h-1 rounded-full bg-app-border overflow-hidden">
              <div className="h-full bg-blue-500 animate-pulse rounded-full w-2/3" />
            </div>
          </div>
        </div>
      )}

      <ImagePreviewModal
        src={previewItem?.src || ''}
        open={!!previewItem}
        onClose={() => { setPreviewItem(null); setPreviewCutMode(false) }}
        onSlicesReady={handleSlicesReady}
        startInCutMode={previewCutMode}
        ossConfig={ossConfig}
        imageCount={allImageItems.length}
        imageIndex={previewIndex}
        onNavigate={handleNavigate}
      />
    </aside>
  )
}
