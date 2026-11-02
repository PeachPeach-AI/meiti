'use client'

import React, { useState } from 'react'
import { useAppStore } from '@/store'
import { Eye, EyeOff, Save, Mail, ChevronDown } from 'lucide-react'
import { SIZE_OPTIONS, QUALITY_OPTIONS, IMAGE_MODELS, TEXT_MODELS } from '@/types'
import type { ImageSizePreset, Quality, ImageSize } from '@/types'
import { fetchModels } from '@/lib/api'
import { CheckRow } from '@/components/ui/CheckRow'

function toModelOptions(ids: readonly string[]) {
  return ids.map((id) => ({ id, displayName: id }))
}

function isImageModel(id: string) {
  const value = id.toLowerCase()
  return value.includes('image') || value.includes('dall-e') || value.includes('midjourney') || value.includes('flux') || value.includes('stable')
    || value.includes('seedream') || value.includes('doubao') || value.includes('volc') || value.includes('ark')
    || value.includes('kolors') || value.includes('ideogram') || value.includes('recraft')
}

function isTextModel(id: string) {
  return !isImageModel(id)
}
export function SettingsPanel() {
  const {
    imageApiKey, setImageApiKey,
    imageApiBaseUrl, setImageApiBaseUrl,
    textApiKey, setTextApiKey,
    textApiBaseUrl, setTextApiBaseUrl,
    ossEndpoint, setOssEndpoint,
    ossAccessKey, setOssAccessKey,
    ossSecretKey, setOssSecretKey,
    ossBucket, setOssBucket,
    ossRegion, setOssRegion,
    ossCdnDomain, setOssCdnDomain,
    rememberKey, setRememberKey,
    selectedImageModel, setSelectedImageModel,
    selectedTextModel, setSelectedTextModel,
    availableImageModels, setAvailableImageModels,
    availableTextModels, setAvailableTextModels,
    selectedSize, setSelectedSize,
    customWidth, setCustomWidth,
    customHeight, setCustomHeight,
    quality, setQuality,
    quantity, setQuantity,
    cleanPromptBeforeGen, setCleanPromptBeforeGen,
    showMoreSizes, setShowMoreSizes,
    advancedOpen, setAdvancedOpen,
    emailNotify, setEmailNotify,
    notifyEmail, setNotifyEmail,
  } = useAppStore()

  const [showImageKey, setShowImageKey] = useState(false)
  const [showTextKey, setShowTextKey] = useState(false)
  const [showOssSecretKey, setShowOssSecretKey] = useState(false)
  const [loadingImageModels, setLoadingImageModels] = useState(false)
  const [loadingTextModels, setLoadingTextModels] = useState(false)

  const handleRefreshImageModels = async () => {
    if (!imageApiKey || !imageApiBaseUrl) return
    setLoadingImageModels(true)
    try {
      const models = await fetchModels(imageApiBaseUrl, imageApiKey)
      const imageModels = models.filter((m) => isImageModel(m.id))
      const nextImageModels = imageModels.length > 0 ? imageModels : toModelOptions(IMAGE_MODELS)
      setAvailableImageModels(nextImageModels)
      if (!nextImageModels.find((m) => m.id === selectedImageModel)) {
        setSelectedImageModel(nextImageModels[0].id)
      }
    } catch {
      // keep current image models
    } finally {
      setLoadingImageModels(false)
    }
  }

  const handleRefreshTextModels = async () => {
    if (!textApiKey || !textApiBaseUrl) return
    setLoadingTextModels(true)
    try {
      const models = await fetchModels(textApiBaseUrl, textApiKey)
      const textModels = models.filter((m) => isTextModel(m.id))
      const nextTextModels = textModels.length > 0 ? textModels : toModelOptions(TEXT_MODELS)
      setAvailableTextModels(nextTextModels)
      if (!nextTextModels.find((m) => m.id === selectedTextModel)) {
        setSelectedTextModel(nextTextModels[0].id)
      }
    } catch {
      // keep current text models
    } finally {
      setLoadingTextModels(false)
    }
  }

  const handleSizeSelect = (preset: ImageSizePreset) => {
    if (preset === 'custom') {
      setSelectedSize({ preset, width: 0, height: 0 })
      return
    }
    const opt = SIZE_OPTIONS.find((o) => o.preset === preset)
    if (opt) {
      setSelectedSize({ preset, width: opt.w, height: opt.h })
    }
  }

  const imageModelOptions = React.useMemo(() => {
    if (!selectedImageModel) return availableImageModels
    return availableImageModels.some((m) => m.id === selectedImageModel)
      ? availableImageModels
      : [{ id: selectedImageModel, displayName: selectedImageModel }, ...availableImageModels]
  }, [availableImageModels, selectedImageModel])

  return (
    <aside className="flex flex-col h-full overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[var(--app-border)] shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-[var(--app-text)]">参数配置</h2>
          <p className="mt-0.5 text-[11.5px] text-[var(--app-text-muted)]">模型、尺寸与生成质量</p>
        </div>
        <span className="text-2xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">BYOK</span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 text-sm">

        {/* Image model */}
        <div className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-xs text-app-text-secondary">
            生图模型
            <button
              type="button"
              onClick={handleRefreshImageModels}
              disabled={loadingImageModels || !imageApiKey || !imageApiBaseUrl}
              className="text-2xs text-blue-500 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loadingImageModels ? '刷新中…' : '刷新'}
            </button>
          </span>
          <select
            value={selectedImageModel}
            onChange={(e) => setSelectedImageModel(e.target.value)}
            className="w-full rounded-md border border-app-border bg-transparent px-2.5 py-1.5 text-xs text-app-text focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          >
            {imageModelOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.displayName || m.id}</option>
            ))}
          </select>
        </div>

        {/* Size */}
        <div className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-xs text-app-text-secondary">
            尺寸
            <button
              type="button"
              onClick={() => setShowMoreSizes(!showMoreSizes)}
              className="text-2xs text-blue-500 hover:text-blue-600"
            >
              {showMoreSizes ? '收起' : '更多尺寸'}
            </button>
          </span>
          <div className="grid grid-cols-2 gap-1">
            {(showMoreSizes ? SIZE_OPTIONS : SIZE_OPTIONS.slice(0, 7)).map((opt) => (
              <button
                key={opt.preset}
                type="button"
                onClick={() => handleSizeSelect(opt.preset)}
                className={`flex flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left transition-colors ${
                  selectedSize.preset === opt.preset
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-app-border hover:border-surface-300 dark:hover:border-white/20'
                }`}
              >
                <b className="text-xs">{opt.label}</b>
                <small className="text-2xs text-app-text-muted">{opt.desc}</small>
              </button>
            ))}
          </div>
          {selectedSize.preset === 'custom' && (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={16}
                step={16}
                value={customWidth}
                onChange={(e) => setCustomWidth(Number(e.target.value))}
                placeholder="宽"
                className="w-full rounded-md border border-app-border bg-transparent px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <span className="text-app-text-muted">x</span>
              <input
                type="number"
                min={16}
                step={16}
                value={customHeight}
                onChange={(e) => setCustomHeight(Number(e.target.value))}
                placeholder="高"
                className="w-full rounded-md border border-app-border bg-transparent px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          )}
        </div>

        {/* Quality */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-app-text-secondary">质量</span>
          <div className="flex rounded-md border border-app-border overflow-hidden">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setQuality(opt.value)}
                className={`flex-1 py-1 px-1 text-xs transition-colors ${
                  quality === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-app-bg-hover text-app-text-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-app-text-secondary">数量</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity(quantity - 1)}
              disabled={quantity <= 1}
              className="w-7 h-7 flex items-center justify-center rounded-md border border-app-border text-sm disabled:opacity-30 hover:bg-app-bg-hover"
            >
              -
            </button>
            <strong className="text-sm min-w-[1.5rem] text-center">{quantity}</strong>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              disabled={quantity >= 10}
              className="w-7 h-7 flex items-center justify-center rounded-md border border-app-border text-sm disabled:opacity-30 hover:bg-app-bg-hover"
            >
              +
            </button>
          </div>
        </div>

        {/* Clean Prompt */}
        <CheckRow
          checked={cleanPromptBeforeGen}
          onChange={setCleanPromptBeforeGen}
          label="生成前先清洗提示词，会额外调用一次文本模型"
          className="text-2xs"
        />

        {/* Advanced */}
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="flex items-center gap-1 text-xs text-app-text-secondary hover:text-app-text w-full"
        >
          高级设置
          <ChevronDown
            size={14}
            className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {advancedOpen && (
          <div className="space-y-3 pt-1 border-t border-app-border">
            <p className="text-2xs text-app-text-muted leading-relaxed">
              Key 只保存在当前浏览器。本工具不会保存密钥，服务端只负责转发本次请求。
            </p>
            <CheckRow
              checked={emailNotify}
              onChange={setEmailNotify}
              label="生图完成后发送邮件"
            />
            <label className="flex flex-col gap-1">
              <span className="text-xs text-app-text-secondary">接收邮箱</span>
              <div className="relative flex items-center">
                <input
                  disabled={!emailNotify}
                  placeholder="name@example.com"
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  className="w-full rounded-md border border-app-border bg-transparent px-2.5 py-1.5 pr-8 text-sm placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Mail size={14} className="absolute right-2 text-app-text-muted pointer-events-none" />
              </div>
            </label>
          </div>
        )}
      </div>
    </aside>
  )
}







