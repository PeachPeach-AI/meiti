'use client'
/* 与「智能体模式(Easel)」共用接口配置：启动时从 Easel 拉取真实配置写入本应用 store，
   本地改动则回写到 Easel（.env），实现一处配置、两边共用。 */
import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'

const EASEL = 'http://localhost:7866'

async function pull(group: string) {
  try {
    const r = await fetch(`${EASEL}/api/local/model-config?group=${group}`)
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

function push(group: string, apiKey: string, baseUrl: string, model: string) {
  fetch(`${EASEL}/api/local/model-config`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group, apiKey, baseUrl, model }),
  }).catch(() => {})
}

export function SharedConfigBridge() {
  const imageApiKey = useAppStore((s) => s.imageApiKey)
  const imageApiBaseUrl = useAppStore((s) => s.imageApiBaseUrl)
  const selectedImageModel = useAppStore((s) => s.selectedImageModel)
  const videoApiKey = useAppStore((s) => s.videoApiKey)
  const videoApiBaseUrl = useAppStore((s) => s.videoApiBaseUrl)
  const selectedVideoModel = useAppStore((s) => s.selectedVideoModel)
  const textApiKey = useAppStore((s) => s.textApiKey)
  const textApiBaseUrl = useAppStore((s) => s.textApiBaseUrl)
  const selectedTextModel = useAppStore((s) => s.selectedTextModel)

  const baseline = useRef('')
  const snap = [imageApiKey, imageApiBaseUrl, selectedImageModel, videoApiKey, videoApiBaseUrl, selectedVideoModel, textApiKey, textApiBaseUrl, selectedTextModel].join('\u0001')

  useEffect(() => {
    (async () => {
      const [img, vid, chat] = await Promise.all([pull('image'), pull('video'), pull('chat')])
      const st = useAppStore.getState()
      if (img) {
        if (img.apiKey) st.setImageApiKey(img.apiKey)
        if (img.baseUrl) st.setImageApiBaseUrl(img.baseUrl)
        if (img.model) st.setSelectedImageModel(img.model)
      }
      if (vid) {
        if (vid.apiKey) st.setVideoApiKey(vid.apiKey)
        if (vid.baseUrl) st.setVideoApiBaseUrl(vid.baseUrl)
        if (vid.model) st.setSelectedVideoModel(vid.model)
      }
      if (chat) {
        if (chat.apiKey) st.setTextApiKey(chat.apiKey)
        if (chat.baseUrl) st.setTextApiBaseUrl(chat.baseUrl)
        if (chat.model) st.setSelectedTextModel(chat.model)
      }
      const s2 = useAppStore.getState()
      baseline.current = [s2.imageApiKey, s2.imageApiBaseUrl, s2.selectedImageModel, s2.videoApiKey, s2.videoApiBaseUrl, s2.selectedVideoModel, s2.textApiKey, s2.textApiBaseUrl, s2.selectedTextModel].join('\u0001')
    })()
  }, [])

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!baseline.current || snap === baseline.current) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      push('image', imageApiKey, imageApiBaseUrl, selectedImageModel)
      push('video', videoApiKey, videoApiBaseUrl, selectedVideoModel)
      push('chat', textApiKey, textApiBaseUrl, selectedTextModel)
      baseline.current = snap
    }, 900)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [snap])

  return null
}
