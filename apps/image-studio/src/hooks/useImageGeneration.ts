'use client'

import { useCallback } from 'react'
import { useAppStore } from '@/store'
import { generateId, generateImage, cleanPrompt, extractPromptFromImage, taskToHistory } from '@/lib/api'
import type { GenerationTask } from '@/types'

export function useImageGeneration() {
  const {
    imageApiKey,
    imageApiBaseUrl,
    textApiKey,
    textApiBaseUrl,
    selectedImageModel,
    selectedTextModel,
    planExpiredAt,
    prompt,
    quality,
    quantity,
    cleanPromptBeforeGen,
    getSizeString,
    activeMode,
    referenceImages,
    addTask,
    updateTask,
    addHistoryItem,
    taskQueue,
  } = useAppStore()

  const submitGeneration = useCallback(async (imageBase64?: string | null) => {
    const refs = referenceImages.length ? referenceImages : (imageBase64 ? [imageBase64] : [])
    const hasImageInput = refs.length > 0 && (activeMode === 'img2img' || activeMode === 'fusion' || activeMode === 'extract')
    if (!imageApiKey || !imageApiBaseUrl) {
      const taskId = generateId()
      const msg = !imageApiKey && !imageApiBaseUrl
        ? '请先在模型配置填写图片 API Key 和 Base URL（例如火山引擎）'
        : !imageApiKey
          ? '请先在模型配置填写图片 API Key'
          : '请先在模型配置填写图片 API Base URL'
      addTask({ id: taskId, mode: activeMode, prompt, model: selectedImageModel, size: getSizeString(), quality, status: 'failed', error: msg, createdAt: Date.now() })
      return
    }
    if (!prompt.trim() && !hasImageInput) return

    if (planExpiredAt > 0 && Date.now() > planExpiredAt) {
      const taskId = generateId()
      const task: GenerationTask = {
        id: taskId, mode: 'text2img', prompt: '', model: '', size: '', quality: 'standard',
        status: 'failed', error: '订阅已到期，请续费后继续使用', createdAt: Date.now(),
      }
      addTask(task)
      updateTask(taskId, { status: 'failed', error: '订阅已到期，请续费后继续使用' })
      return
    }

    // 提示词提取：extract 模式解析为文字；img2img / fusion 有提示词时直接把原图作为参考图提交，
    // 没写提示词时仍解析一次，避免空提示词请求。
    let finalPrompt = prompt
    const needExtract = refs.length > 0 && (
      activeMode === 'extract'
      || (!finalPrompt.trim() && (activeMode === 'img2img' || activeMode === 'fusion'))
    )
    if (needExtract) {
      if (!textApiKey || !textApiBaseUrl) {
        const taskId = generateId()
        const task: GenerationTask = { id: taskId, mode: activeMode, prompt, model: selectedImageModel, size: getSizeString(), quality, status: 'failed', error: '请先配置文本模型 Key', createdAt: Date.now() }
        addTask(task)
        return
      }
      try {
        const extracted = await extractPromptFromImage(textApiBaseUrl, textApiKey, selectedTextModel, refs[0])
        if (extracted) {
          finalPrompt = prompt.trim() ? prompt + ', ' + extracted : extracted
        }
        if (!finalPrompt.trim()) {
          const taskId = generateId()
          const task: GenerationTask = { id: taskId, mode: activeMode, prompt, model: selectedImageModel, size: getSizeString(), quality, status: 'failed', error: '图片解析返回空结果', createdAt: Date.now() }
          addTask(task)
          return
        }
      } catch (err: unknown) {
        if (!prompt.trim()) {
          const taskId = generateId()
          const msg = err instanceof Error ? err.message : '图片解析失败'
          const task: GenerationTask = { id: taskId, mode: activeMode, prompt, model: selectedImageModel, size: getSizeString(), quality, status: 'failed', error: msg, createdAt: Date.now() }
          addTask(task)
          return
        }
      }
    }

    if (cleanPromptBeforeGen && textApiKey && textApiBaseUrl) {
      try {
        finalPrompt = await cleanPrompt(textApiBaseUrl, textApiKey, selectedTextModel, finalPrompt)
      } catch { /* fallback */ }
    }

    for (let i = 0; i < quantity; i++) {
      const task: GenerationTask = {
        id: generateId(),
        mode: activeMode,
        prompt: finalPrompt,
        model: selectedImageModel,
        size: getSizeString(),
        quality,
        status: 'queued',
        referenceImages: activeMode === 'extract' ? undefined : refs,
        createdAt: Date.now(),
      }
      addTask(task)
      updateTask(task.id, { status: 'running' })

      try {
        const result = await generateImage(imageApiBaseUrl, imageApiKey, task)
        updateTask(task.id, { ...result, status: 'success' })
        const historyItem = taskToHistory(result)
        addHistoryItem(historyItem)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '未知错误'
        updateTask(task.id, { status: 'failed', error: msg })
      }
    }
  }, [
    imageApiKey, imageApiBaseUrl, textApiKey, textApiBaseUrl, selectedImageModel, selectedTextModel,
    planExpiredAt, prompt, quality, quantity, cleanPromptBeforeGen, getSizeString, activeMode,
    referenceImages, addTask, updateTask, addHistoryItem,
  ])

  return { submitGeneration, taskQueue }
}




