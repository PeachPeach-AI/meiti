'use client'

import React, { useEffect, useCallback, useState, useRef } from 'react'
import { X, Download, Copy, ZoomIn, ZoomOut, Check, Scissors, Plus, Minus, Share2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

interface ImagePreviewModalProps {
  src: string
  alt?: string
  open: boolean
  onClose: () => void
  onSlicesReady?: (slices: string[]) => void
  startInCutMode?: boolean
  ossConfig?: {
    ossEndpoint: string
    ossAccessKey: string
    ossSecretKey: string
    ossBucket: string
    ossRegion: string
    ossCdnDomain: string
  }
  imageCount?: number
  imageIndex?: number
  onNavigate?: (index: number) => void
}

function base64ToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
  const binary = atob(parts[1])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

export function ImagePreviewModal({ src, alt = '', open, onClose, onSlicesReady, startInCutMode = false, ossConfig, imageCount, imageIndex, onNavigate }: ImagePreviewModalProps) {
  const [zoomed, setZoomed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [cutMode, setCutMode] = useState(false)
  const [hCount, setHCount] = useState(2)
  const [vCount, setVCount] = useState(2)
  const [hLines, setHLines] = useState<number[]>([])
  const [vLines, setVLines] = useState<number[]>([])
  const [dragging, setDragging] = useState<{ type: 'h' | 'v'; index: number } | null>(null)
  const [sharing, setSharing] = useState(false)
  const [sharedUrl, setSharedUrl] = useState('')
  const [cutting, setCutting] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const cutModeRef = useRef(false)
  const onCloseRef = useRef(onClose)
  const onSlicesReadyRef = useRef(onSlicesReady)

  onCloseRef.current = onClose
  onSlicesReadyRef.current = onSlicesReady
  cutModeRef.current = cutMode

  /* ---- initialize on open/close ---- */
  useEffect(() => {
    if (!open) {
      setZoomed(false)
      setCopied(false)
      setCutMode(false)
      cutModeRef.current = false
      setHCount(2)
      setVCount(2)
      return
    }
    const initCutMode = !!startInCutMode && !!onSlicesReadyRef.current
    setCutMode(initCutMode)
    cutModeRef.current = initCutMode
    setZoomed(false)
    setCopied(false)
  }, [open, startInCutMode])

  /* ---- keyboard ---- */
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cutModeRef.current) {
          setCutMode(false)
        } else {
          onCloseRef.current()
        }
        return
      }
      if (cutModeRef.current) return
      if (e.key === 'ArrowLeft' && onNavigate && imageCount && imageIndex != null) {
        e.preventDefault()
        const prev = imageIndex - 1
        if (prev >= 0) onNavigate(prev)
        return
      }
      if (e.key === 'ArrowRight' && onNavigate && imageCount && imageIndex != null) {
        e.preventDefault()
        const next = imageIndex + 1
        if (next < imageCount) onNavigate(next)
        return
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onNavigate, imageCount, imageIndex])

  /* ---- line positions sync ---- */
  useEffect(() => {
    setHLines((prev) => {
      const next: number[] = []
      for (let i = 1; i < hCount; i++) {
        next.push(prev[i - 1] ?? (i / hCount) * 100)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hCount])

  useEffect(() => {
    setVLines((prev) => {
      const next: number[] = []
      for (let i = 1; i < vCount; i++) {
        next.push(prev[i - 1] ?? (i / vCount) * 100)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vCount])

  /* ---- drag ---- */
  useEffect(() => {
    if (!dragging || !imgRef.current || !open) return

    const handleMouseMove = (e: MouseEvent) => {
      const img = imgRef.current!
      const rect = img.getBoundingClientRect()

      if (dragging.type === 'h') {
        const pct = ((e.clientY - rect.top) / rect.height) * 100
        setHLines((prev) => {
          const next = [...prev]
          const lo = dragging.index > 0 ? prev[dragging.index - 1] : 2
          const hi = dragging.index < prev.length - 1 ? prev[dragging.index + 1] : 98
          next[dragging.index] = Math.max(lo, Math.min(hi, pct))
          return next
        })
      } else {
        const pct = ((e.clientX - rect.left) / rect.width) * 100
        setVLines((prev) => {
          const next = [...prev]
          const lo = dragging.index > 0 ? prev[dragging.index - 1] : 2
          const hi = dragging.index < prev.length - 1 ? prev[dragging.index + 1] : 98
          next[dragging.index] = Math.max(lo, Math.min(hi, pct))
          return next
        })
      }
    }

    const handleMouseUp = () => setDragging(null)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, open])

  /* ---- actions ---- */
  const handleCopy = useCallback(async () => {
    try {
      const blob = base64ToBlob(src)
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      await navigator.clipboard.writeText(src)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [src])

  const handleDownload = useCallback(() => {
    const a = document.createElement('a')
    a.href = src
    a.download = `image2-${Date.now()}.png`
    a.click()
  }, [src])

  const handleShare = useCallback(async () => {
    if (!ossConfig || sharing) return
    setSharing(true)
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
        body: JSON.stringify({ image: src }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '上传失败')
      await navigator.clipboard.writeText(data.url)
      setSharedUrl(data.url)
      setTimeout(() => setSharedUrl(''), 4000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '分享失败'
      setSharedUrl(msg)
      setTimeout(() => setSharedUrl(''), 4000)
    } finally {
      setSharing(false)
    }
  }, [src, ossConfig, sharing])

  const handleCut = useCallback(async () => {
    const img = imgRef.current
    if (!img || !onSlicesReadyRef.current || cutting) return

    const naturalW = img.naturalWidth
    const naturalH = img.naturalHeight

    const hPos = [0, ...hLines.map((p) => Math.round((p / 100) * naturalH)), naturalH]
    const vPos = [0, ...vLines.map((p) => Math.round((p / 100) * naturalW)), naturalW]

    const slices: string[] = []
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    for (let row = 0; row < hCount; row++) {
      for (let col = 0; col < vCount; col++) {
        const x = vPos[col]
        const y = hPos[row]
        const w = vPos[col + 1] - x
        const h = hPos[row + 1] - y
        canvas.width = w
        canvas.height = h
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h)
        slices.push(canvas.toDataURL('image/png'))
      }
    }

    setCutting(true)
    let urls: string[] | null = null

    if (ossConfig) {
      try {
        const results = await Promise.all(
          slices.map(async (slice) => {
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
              body: JSON.stringify({ image: slice }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            return data.url as string
          })
        )
        urls = results
      } catch {
        // fall through to use base64
      }
    }

    setCutting(false)
    onSlicesReadyRef.current(urls || slices)
    setCutMode(false)
    onCloseRef.current()
  }, [hLines, vLines, hCount, vCount, ossConfig, cutting])

  const enterCutMode = useCallback(() => {
    setZoomed(false)
    setCutMode(true)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !cutMode) onClose() }}
    >
      {/* close */}
      <button
        type="button"
        onClick={() => { if (cutMode) { setCutMode(false) } else { onClose() } }}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
      >
        <X size={20} />
      </button>

      {/* nav arrows */}
      {!cutMode && onNavigate && imageCount && imageCount > 1 && imageIndex != null && (
        <>
          <button
            type="button"
            onClick={() => { if (imageIndex > 0) onNavigate(imageIndex - 1) }}
            disabled={imageIndex <= 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-20 disabled:cursor-default transition-colors z-10"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            type="button"
            onClick={() => { if (imageIndex < imageCount - 1) onNavigate(imageIndex + 1) }}
            disabled={imageIndex >= imageCount - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-20 disabled:cursor-default transition-colors z-10"
          >
            <ChevronRight size={28} />
          </button>
          <span className="absolute top-4 left-1/2 -translate-x-1/2 text-xs text-white/50 z-10">
            {imageIndex + 1} / {imageCount}
          </span>
        </>
      )}

      {/* image + overlay */}
      <div className="relative inline-block">
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          onClick={() => { if (!cutMode) setZoomed(!zoomed) }}
          className={
            cutMode
              ? 'max-w-[88vw] max-h-[78vh] object-contain rounded-lg'
              : zoomed
                ? 'max-w-none cursor-zoom-out'
                : 'max-w-[90vw] max-h-[85vh] object-contain rounded-lg cursor-zoom-in'
          }
          draggable={false}
        />

        {cutMode && (
          <div className="absolute inset-0">
            {/* cell labels */}
            {Array.from({ length: hCount }).map((_, row) =>
              Array.from({ length: vCount }).map((_, col) => {
                const top = row === 0 ? 0 : hLines[row - 1]
                const bottom = row === hCount - 1 ? 100 : hLines[row]
                const left = col === 0 ? 0 : vLines[col - 1]
                const right = col === vCount - 1 ? 100 : vLines[col]
                return (
                  <div
                    key={`${row}-${col}`}
                    className="absolute flex items-center justify-center pointer-events-none"
                    style={{
                      top: `${top}%`,
                      left: `${left}%`,
                      width: `${right - left}%`,
                      height: `${bottom - top}%`,
                    }}
                  >
                    <span className="text-white/60 text-xs font-mono bg-black/30 px-1 rounded">
                      {row + 1},{col + 1}
                    </span>
                  </div>
                )
              })
            )}

            {/* horizontal lines */}
            {hLines.map((pct, i) => (
              <div
                key={`h-${i}`}
                className="absolute left-0 right-0"
                style={{ top: `${pct}%` }}
              >
                {/* hit area */}
                <div
                  className="absolute left-0 right-0 h-4 -translate-y-1/2 cursor-row-resize z-10"
                  onMouseDown={(e) => { e.stopPropagation(); setDragging({ type: 'h', index: i }) }}
                />
                {/* visual line */}
                <div className="absolute left-0 right-0 h-px bg-blue-400 -translate-y-1/2 shadow-[0_0_6px_rgba(96,165,250,0.6)] pointer-events-none" />
              </div>
            ))}

            {/* vertical lines */}
            {vLines.map((pct, i) => (
              <div
                key={`v-${i}`}
                className="absolute top-0 bottom-0"
                style={{ left: `${pct}%` }}
              >
                {/* hit area */}
                <div
                  className="absolute top-0 bottom-0 w-4 -translate-x-1/2 cursor-col-resize z-10"
                  onMouseDown={(e) => { e.stopPropagation(); setDragging({ type: 'v', index: i }) }}
                />
                {/* visual line */}
                <div className="absolute top-0 bottom-0 w-px bg-blue-400 -translate-x-1/2 shadow-[0_0_6px_rgba(96,165,250,0.6)] pointer-events-none" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* toolbar */}
      {cutMode ? (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md text-white">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/70">水平</span>
            <button
              type="button"
              onClick={() => setHCount(Math.max(1, hCount - 1))}
              disabled={hCount <= 1}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <Minus size={14} />
            </button>
            <span className="text-sm font-medium min-w-[1.25rem] text-center">{hCount}</span>
            <button
              type="button"
              onClick={() => setHCount(Math.min(10, hCount + 1))}
              disabled={hCount >= 10}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="w-px h-6 bg-white/20" />

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/70">垂直</span>
            <button
              type="button"
              onClick={() => setVCount(Math.max(1, vCount - 1))}
              disabled={vCount <= 1}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <Minus size={14} />
            </button>
            <span className="text-sm font-medium min-w-[1.25rem] text-center">{vCount}</span>
            <button
              type="button"
              onClick={() => setVCount(Math.min(10, vCount + 1))}
              disabled={vCount >= 10}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="w-px h-6 bg-white/20" />

          <span className="text-xs text-white/50">{hCount * vCount} 张</span>

          <button
            type="button"
            onClick={handleCut}
            disabled={cutting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {cutting ? <Loader2 size={14} className="animate-spin" /> : null}
            {cutting ? '上传中...' : '确认裁切'}
          </button>

          <button
            type="button"
            onClick={() => setCutMode(false)}
            className="px-3 py-1.5 rounded-lg hover:bg-white/10 text-sm transition-colors"
          >
            取消
          </button>
        </div>
      ) : (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-md text-white">
          <button
            type="button"
            onClick={() => setZoomed(!zoomed)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title={zoomed ? '适应窗口' : '原始尺寸'}
          >
            {zoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
          </button>

          {onSlicesReadyRef.current && (
            <button
              type="button"
              onClick={enterCutMode}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm"
            >
              <Scissors size={16} />
              裁切
            </button>
          )}

          {ossConfig && (
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm disabled:opacity-50"
            >
              {sharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              {sharing ? '上传中' : sharedUrl ? (sharedUrl.startsWith('http') ? '已复制链接' : sharedUrl) : '分享'}
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm"
          >
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            {copied ? '已复制' : '复制图片'}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm"
          >
            <Download size={16} />
            下载
          </button>
        </div>
      )}
    </div>
  )
}
