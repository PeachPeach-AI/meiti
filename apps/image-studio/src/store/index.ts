import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CreationMode, Quality, ImageSize, Model, GenerationTask, HistoryItem, HistoryFilter, TaskStatus } from '@/types'
import { SIZE_OPTIONS, IMAGE_MODELS, TEXT_MODELS, DEFAULT_API_BASE } from '@/types'

export interface AppState {
  // Settings
  apiKey: string
  apiBaseUrl: string
  imageApiKey: string
  imageApiBaseUrl: string
  textApiKey: string
  textApiBaseUrl: string
  ossEndpoint: string
  ossAccessKey: string
  ossSecretKey: string
  ossBucket: string
  ossRegion: string
  ossCdnDomain: string
  rememberKey: boolean
  selectedModel: string
  selectedImageModel: string
  selectedTextModel: string
  availableModels: Model[]
  availableImageModels: Model[]
  availableTextModels: Model[]
  selectedSize: ImageSize
  customWidth: number
  customHeight: number
  quality: Quality
  quantity: number
  cleanPromptBeforeGen: boolean
  showMoreSizes: boolean

  // Advanced
  advancedOpen: boolean
  emailNotify: boolean
  notifyEmail: string
  currentPlan: string
  currentPlanName: string
  planActivatedAt: number
  planExpiredAt: number

  // Mode
  activeMode: CreationMode
  prompt: string
  referenceImages: string[]
  referenceDocument: File | null

  // Queue
  taskQueue: GenerationTask[]

  // History
  history: HistoryItem[]
  historyFilter: HistoryFilter
  historySearch: string
  historyPage: number
  pageSize: number

  // Theme
  theme: 'light' | 'dark'

  // Panel
  leftPanelWidth: number
  rightPanelWidth: number

  // Actions
  setApiKey: (key: string) => void
  setApiBaseUrl: (url: string) => void
  setImageApiKey: (key: string) => void
  setImageApiBaseUrl: (url: string) => void
  setTextApiKey: (key: string) => void
  setTextApiBaseUrl: (url: string) => void
  setOssEndpoint: (url: string) => void
  setOssAccessKey: (key: string) => void
  setOssSecretKey: (key: string) => void
  setOssBucket: (bucket: string) => void
  setOssRegion: (region: string) => void
  setOssCdnDomain: (domain: string) => void
  setRememberKey: (v: boolean) => void
  setSelectedModel: (model: string) => void
  setSelectedImageModel: (model: string) => void
  setSelectedTextModel: (model: string) => void
  setAvailableModels: (models: Model[]) => void
  setAvailableImageModels: (models: Model[]) => void
  setAvailableTextModels: (models: Model[]) => void
  setSelectedSize: (size: ImageSize) => void
  setCustomWidth: (w: number) => void
  setCustomHeight: (h: number) => void
  setQuality: (q: Quality) => void
  setQuantity: (n: number) => void
  setCleanPromptBeforeGen: (v: boolean) => void
  setShowMoreSizes: (v: boolean) => void
  setAdvancedOpen: (v: boolean) => void
  setEmailNotify: (v: boolean) => void
  setNotifyEmail: (v: string) => void
  setCurrentPlan: (plan: string, name: string, durationDays: number) => void
  setActiveMode: (mode: CreationMode) => void
  setPrompt: (p: string) => void
  setReferenceImages: (imgs: string[]) => void
  addTask: (task: GenerationTask) => void
  updateTask: (id: string, updates: Partial<GenerationTask>) => void
  addHistoryItem: (item: HistoryItem) => void
  addHistoryItems: (items: HistoryItem[]) => void
  clearHistory: () => void
  deleteHistoryItem: (id: string) => void
  setHistoryFilter: (f: HistoryFilter) => void
  setHistorySearch: (s: string) => void
  setHistoryPage: (p: number) => void
  toggleTheme: () => void
  setLeftPanelWidth: (w: number) => void
  setRightPanelWidth: (w: number) => void
  getSizeString: () => string
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Settings
      apiKey: '',
      apiBaseUrl: DEFAULT_API_BASE,
      imageApiKey: '',
      imageApiBaseUrl: DEFAULT_API_BASE,
      textApiKey: '',
      textApiBaseUrl: DEFAULT_API_BASE,
      ossEndpoint: '',
      ossAccessKey: '',
      ossSecretKey: '',
      ossBucket: '',
      ossRegion: '',
      ossCdnDomain: '',
      rememberKey: true,
      selectedModel: IMAGE_MODELS[0],
      selectedImageModel: IMAGE_MODELS[0],
      selectedTextModel: TEXT_MODELS[0],
      availableModels: IMAGE_MODELS.map(id => ({ id, displayName: id })),
      availableImageModels: IMAGE_MODELS.map(id => ({ id, displayName: id })),
      availableTextModels: TEXT_MODELS.map(id => ({ id, displayName: id })),
      selectedSize: { preset: '1024x1024', width: 1024, height: 1024 },
      customWidth: 1024,
      customHeight: 1024,
      quality: 'standard',
      quantity: 1,
      cleanPromptBeforeGen: false,
      showMoreSizes: false,

      // Advanced
      advancedOpen: false,
      emailNotify: false,
      notifyEmail: '',
      currentPlan: '',
      currentPlanName: '',
      planActivatedAt: 0,
      planExpiredAt: 0,

      // Mode
      activeMode: 'text2img',
      prompt: '一张高级产品海报，深色背景，清晰主体，电影级光影，细节丰富，适合电商首图',
      referenceImages: [],
      referenceDocument: null,

      // Queue
      taskQueue: [],

      // History
      history: [],
      historyFilter: 'all',
      historySearch: '',
      historyPage: 1,
      pageSize: 20,

      // Theme
      theme: 'light',

      // Panel
      leftPanelWidth: 282,
      rightPanelWidth: 336,

      // Actions
      setApiKey: (key) => set({ apiKey: key, imageApiKey: key }),
      setApiBaseUrl: (url) => set({ apiBaseUrl: url, imageApiBaseUrl: url }),
      setImageApiKey: (key) => set({ imageApiKey: key, apiKey: key }),
      setImageApiBaseUrl: (url) => set({ imageApiBaseUrl: url, apiBaseUrl: url }),
      setTextApiKey: (key) => set({ textApiKey: key }),
      setTextApiBaseUrl: (url) => set({ textApiBaseUrl: url }),
      setOssEndpoint: (url) => set({ ossEndpoint: url }),
      setOssAccessKey: (key) => set({ ossAccessKey: key }),
      setOssSecretKey: (key) => set({ ossSecretKey: key }),
      setOssBucket: (bucket) => set({ ossBucket: bucket }),
      setOssRegion: (region) => set({ ossRegion: region }),
      setOssCdnDomain: (domain) => set({ ossCdnDomain: domain }),
      setRememberKey: (v) => set({ rememberKey: v }),
      setSelectedModel: (model) => set({ selectedModel: model, selectedImageModel: model }),
      setSelectedImageModel: (model) => set({ selectedImageModel: model, selectedModel: model }),
      setSelectedTextModel: (model) => set({ selectedTextModel: model }),
      setAvailableModels: (models) => set({ availableModels: models, availableImageModels: models }),
      setAvailableImageModels: (models) => set({ availableImageModels: models, availableModels: models }),
      setAvailableTextModels: (models) => set({ availableTextModels: models }),
      setSelectedSize: (size) => set({ selectedSize: size }),
      setCustomWidth: (w) => set({ customWidth: w }),
      setCustomHeight: (h) => set({ customHeight: h }),
      setQuality: (q) => set({ quality: q }),
      setQuantity: (n) => set({ quantity: Math.max(1, Math.min(10, n)) }),
      setCleanPromptBeforeGen: (v) => set({ cleanPromptBeforeGen: v }),
      setShowMoreSizes: (v) => set({ showMoreSizes: v }),
      setAdvancedOpen: (v) => set({ advancedOpen: v }),
      setEmailNotify: (v) => set({ emailNotify: v }),
      setNotifyEmail: (v) => set({ notifyEmail: v }),
      setCurrentPlan: (plan, name, durationDays) => {
        const now = Date.now()
        const expiredAt = now + durationDays * 24 * 60 * 60 * 1000
        set({ currentPlan: plan, currentPlanName: name, planActivatedAt: now, planExpiredAt: expiredAt })
      },
      setActiveMode: (mode) => set({ activeMode: mode, referenceImages: [] }),
      setPrompt: (p) => set({ prompt: p }),
      setReferenceImages: (imgs) => set({ referenceImages: imgs }),
      addTask: (task) => set((s) => ({ taskQueue: [task, ...s.taskQueue] })),
      updateTask: (id, updates) =>
        set((s) => ({
          taskQueue: s.taskQueue.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      addHistoryItem: (item) =>
        set((s) => ({
          history: [item, ...s.history].slice(0, 500),
        })),
      addHistoryItems: (items) =>
        set((s) => {
          const newHistory = [...items, ...s.history].slice(0, 500)
          try {
            const raw = localStorage.getItem('image2-studio-v2')
            const current = raw ? JSON.parse(raw) : {}
            localStorage.setItem('image2-studio-v2', JSON.stringify({
              ...current,
              history: newHistory,
            }))
          } catch { /* quota exceeded, next persist write will retry */ }
          return { history: newHistory }
        }),
      clearHistory: () => set({ history: [], historyPage: 1 }),
      deleteHistoryItem: (id) =>
        set((s) => ({
          history: s.history.filter((h) => h.id !== id),
        })),
      setHistoryFilter: (f) => set({ historyFilter: f, historyPage: 1 }),
      setHistorySearch: (s) => set({ historySearch: s, historyPage: 1 }),
      setHistoryPage: (p) => set({ historyPage: p }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setLeftPanelWidth: (w) => set({ leftPanelWidth: w }),
      setRightPanelWidth: (w) => set({ rightPanelWidth: w }),
      getSizeString: () => {
        const s = get()
        if (s.selectedSize.preset === 'custom') {
          return `${s.customWidth}x${s.customHeight}`
        }
        if (s.selectedSize.preset === 'auto') return 'auto'
        const opt = SIZE_OPTIONS.find((o) => o.preset === s.selectedSize.preset)
        return opt ? `${opt.w}x${opt.h}` : '1024x1024'
      },
    }),
    {
      name: 'image2-studio-v2',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppState>
        const imageApiKey = persisted.imageApiKey ?? persisted.apiKey ?? currentState.imageApiKey
        const imageApiBaseUrl = persisted.imageApiBaseUrl ?? persisted.apiBaseUrl ?? currentState.imageApiBaseUrl
        return {
          ...currentState,
          ...persisted,
          apiKey: imageApiKey,
          apiBaseUrl: imageApiBaseUrl,
          imageApiKey,
          imageApiBaseUrl,
          textApiKey: persisted.textApiKey ?? currentState.textApiKey,
          textApiBaseUrl: persisted.textApiBaseUrl ?? currentState.textApiBaseUrl,
          ossEndpoint: persisted.ossEndpoint ?? currentState.ossEndpoint,
          ossAccessKey: persisted.ossAccessKey ?? currentState.ossAccessKey,
          ossSecretKey: persisted.ossSecretKey ?? currentState.ossSecretKey,
          ossBucket: persisted.ossBucket ?? currentState.ossBucket,
          ossRegion: persisted.ossRegion ?? currentState.ossRegion,
          ossCdnDomain: persisted.ossCdnDomain ?? currentState.ossCdnDomain,
        }
      },
      partialize: (state) => ({
        apiKey: state.rememberKey ? state.imageApiKey : '',
        apiBaseUrl: state.imageApiBaseUrl,
        imageApiKey: state.rememberKey ? state.imageApiKey : '',
        imageApiBaseUrl: state.imageApiBaseUrl,
        textApiKey: state.rememberKey ? state.textApiKey : '',
        textApiBaseUrl: state.textApiBaseUrl,
        ossEndpoint: state.ossEndpoint,
        ossAccessKey: state.rememberKey ? state.ossAccessKey : '',
        ossSecretKey: state.rememberKey ? state.ossSecretKey : '',
        ossBucket: state.ossBucket,
        ossRegion: state.ossRegion,
        ossCdnDomain: state.ossCdnDomain,
        rememberKey: state.rememberKey,
        selectedModel: state.selectedImageModel,
        selectedImageModel: state.selectedImageModel,
        selectedTextModel: state.selectedTextModel,
        selectedSize: state.selectedSize,
        customWidth: state.customWidth,
        customHeight: state.customHeight,
        quality: state.quality,
        quantity: state.quantity,
        cleanPromptBeforeGen: state.cleanPromptBeforeGen,
        emailNotify: state.emailNotify,
        notifyEmail: state.notifyEmail,
        currentPlan: state.currentPlan,
        currentPlanName: state.currentPlanName,
        planActivatedAt: state.planActivatedAt,
        planExpiredAt: state.planExpiredAt,
        history: state.history,
        theme: state.theme,
        leftPanelWidth: state.leftPanelWidth,
        rightPanelWidth: state.rightPanelWidth,
      }),
    }
  )
)





