'use client'

import React, { useState } from 'react'
import { useAppStore } from '@/store'
import { X, Check, ClipboardPaste, Wand2 } from 'lucide-react'

interface ParsedCard {
  imageKey: string
  imageUrl: string
  imageModel: string
  textKey: string
  textUrl: string
  textModel: string
}

function parseCardKey(input: string): ParsedCard | null {
  const trimmed = input.trim()

  // 尝试 JSON
  if (trimmed.startsWith('{')) {
    try {
      const j = JSON.parse(trimmed)
      return {
        imageKey: j.image?.key || j.image_key || '',
        imageUrl: j.image?.url || j.image_url || '',
        imageModel: j.image?.model || j.image_model || '',
        textKey: j.text?.key || j.text_key || '',
        textUrl: j.text?.url || j.text_url || '',
        textModel: j.text?.model || j.text_model || '',
      }
    } catch { /* fall through */ }
  }

  // 尝试 key=value 文本
  const map: Record<string, string> = {}
  for (const line of trimmed.split('\n')) {
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const k = line.slice(0, eq).trim().toUpperCase()
    const v = line.slice(eq + 1).trim()
    map[k] = v
  }

  return {
    imageKey: map['IMAGE_KEY'] || '',
    imageUrl: map['IMAGE_URL'] || '',
    imageModel: map['IMAGE_MODEL'] || '',
    textKey: map['TEXT_KEY'] || '',
    textUrl: map['TEXT_URL'] || '',
    textModel: map['TEXT_MODEL'] || '',
  }
}

export function CardImportModal({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('')
  const [preview, setPreview] = useState<ParsedCard | null>(null)
  const [done, setDone] = useState(false)

  const {
    setImageApiKey,
    setImageApiBaseUrl,
    setSelectedImageModel,
    setTextApiKey,
    setTextApiBaseUrl,
    setSelectedTextModel,
  } = useAppStore()

  const handleParse = () => {
    const parsed = parseCardKey(input)
    if (!parsed || (!parsed.imageKey && !parsed.textKey)) {
      setPreview(null)
      return
    }
    setPreview(parsed)
    setDone(false)
  }

  const handleApply = () => {
    if (!preview) return
    if (preview.imageKey) {
      setImageApiKey(preview.imageKey)
      setImageApiBaseUrl(preview.imageUrl)
    }
    if (preview.imageModel) {
      setSelectedImageModel(preview.imageModel)
    }
    if (preview.textKey) {
      setTextApiKey(preview.textKey)
      setTextApiBaseUrl(preview.textUrl)
    }
    if (preview.textModel) {
      setSelectedTextModel(preview.textModel)
    }
    setDone(true)
    setTimeout(onClose, 1200)
  }

  const hasContent = input.trim().length > 0
  const canApply = preview && (preview.imageKey || preview.textKey)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 rounded-xl border border-app-border bg-app-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-app-border">
          <h2 className="text-sm font-semibold text-app-text">订阅与额度</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-app-bg-hover text-app-text-muted">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                <Check size={24} className="text-white" />
              </div>
              <strong className="text-sm text-app-text">配置完成</strong>
              <span className="text-xs text-app-text-secondary">API Key 和模型已写入浏览器</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-app-text-secondary">
                粘贴卡密，自动识别图片模型与文本模型的 Key、地址、模型名称
              </p>

              {/* Input */}
              <textarea
                value={input}
                onChange={(e) => { setInput(e.target.value); setPreview(null); setDone(false) }}
                placeholder={`支持两种格式：

格式一（Key=Value）：
IMAGE_KEY=sk-xxxxxxxx
IMAGE_URL=https://api.example.com/v1
IMAGE_MODEL=gpt-image-2
TEXT_KEY=sk-yyyyyyyy
TEXT_URL=https://api.example.com/v1
TEXT_MODEL=gpt-4o-mini

格式二（JSON）：
{"image":{"key":"sk-xxx","url":"...","model":"..."},"text":{...}}`}
                rows={8}
                className="w-full rounded-lg border border-app-border bg-app-bg-alt px-3 py-2 text-sm text-app-text placeholder:text-app-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
              />

              {/* Parse button */}
              <button
                type="button"
                onClick={handleParse}
                disabled={!hasContent}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-app-border text-app-text-secondary hover:bg-app-bg-hover disabled:opacity-40"
              >
                <Wand2 size={13} />
                解析卡密
              </button>

              {/* Preview */}
              {preview && (
                <div className="rounded-lg border border-app-border bg-app-bg-alt p-3 space-y-3">
                  {(preview.imageKey || preview.imageUrl) && (
                    <div>
                      <span className="text-2xs text-app-text-muted uppercase tracking-wide">图片模型</span>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1 text-xs">
                        <span className="text-app-text-muted">Key</span>
                        <span className="text-app-text font-mono truncate">{preview.imageKey.slice(0, 16)}...</span>
                        <span className="text-app-text-muted">地址</span>
                        <span className="text-app-text font-mono truncate">{preview.imageUrl}</span>
                        <span className="text-app-text-muted">模型</span>
                        <span className="text-app-text font-mono">{preview.imageModel}</span>
                      </div>
                    </div>
                  )}
                  {(preview.textKey || preview.textUrl) && (
                    <div>
                      <span className="text-2xs text-app-text-muted uppercase tracking-wide">文本模型</span>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1 text-xs">
                        <span className="text-app-text-muted">Key</span>
                        <span className="text-app-text font-mono truncate">{preview.textKey.slice(0, 16)}...</span>
                        <span className="text-app-text-muted">地址</span>
                        <span className="text-app-text font-mono truncate">{preview.textUrl}</span>
                        <span className="text-app-text-muted">模型</span>
                        <span className="text-app-text font-mono">{preview.textModel}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-app-border">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs text-app-text-secondary hover:bg-app-bg-hover"
            >
              取消
            </button>
            <button
              onClick={handleApply}
              disabled={!canApply}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ClipboardPaste size={13} />
              一键配置
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
