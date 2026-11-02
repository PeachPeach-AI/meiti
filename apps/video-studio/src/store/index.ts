import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, Shot, ShotKeyframe, VideoTask, ProjectRecord, ProjectBible, VideoStyle, Resolution, FrameRate, CreationMode, ScriptInputMode, ShotGenerationMode, ProductionStageKey, ShotStatus } from '@/types';

const STORE_VERSION = 6;

let shotCounter = 0;
let keyframeCounter = 0;
let taskCounter = 0;
let recordCounter = 0;
let toastCounter = 0;
function genId() { return 's' + Date.now().toString(36) + (shotCounter++); }
function genKeyframeId() { return 'kf' + Date.now().toString(36) + (keyframeCounter++); }
function genTaskId() { return 't' + Date.now().toString(36) + (taskCounter++); }
function genRecordId() { return 'r' + Date.now().toString(36) + (recordCounter++); }
function genToastId() { return 'toast' + Date.now().toString(36) + (toastCounter++); }
function projectTitle(r: ProjectRecord) {
  return r.title || `项目 ${new Date(r.createdAt || Date.now()).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
}

const DEFAULT_PROJECT_BIBLE: ProjectBible = {
  characters: '',
  scenes: '',
  props: '',
  characterAssets: [
    { id: 'demo-char-1', name: '法国球员', description: '蓝色球衣，短发，表情坚毅', imageUrl: '' },
    { id: 'demo-char-2', name: '裁判', description: '黑色制服，严肃', imageUrl: '' },
  ],
  sceneAssets: [
    { id: 'demo-scene-1', name: '球员通道', description: '昏暗隧道，冷白灯光', imageUrl: '' },
    { id: 'demo-scene-2', name: '绿茵球场', description: '世界杯决赛场地，灯光璀璨', imageUrl: '' },
  ],
  propAssets: [
    { id: 'demo-prop-1', name: '大力神杯', description: '金色奖杯，特写', imageUrl: '' },
    { id: 'demo-prop-2', name: '队长袖标', description: '蓝白红三色袖标', imageUrl: '' },
  ],
  styleRules: '',
  colorRules: '',
  spatialRules: '',
  negativeRules: '不要文字、不要水印、不要变脸、不要多余肢体、不要画面跳变。',
  seedanceRules: '按 10 秒项目段落设计，保持同一人物、服装、场景、光线、色调和构图连续。',
  diagnosisNotes: '',
  postNotes: '',
};

function normalizeProjectBible(raw?: Partial<ProjectBible>): ProjectBible {
  const normalized = { ...DEFAULT_PROJECT_BIBLE, ...(raw || {}) };
  normalized.characterAssets = (Array.isArray(normalized.characterAssets) ? normalized.characterAssets : []).map((a) => ({ ...a, imageUrl: a.imageUrl || ((a as any).imageUrls || [])[0] || '' }));
  normalized.sceneAssets = (Array.isArray(normalized.sceneAssets) ? normalized.sceneAssets : []).map((a) => ({ ...a, imageUrl: a.imageUrl || ((a as any).imageUrls || [])[0] || '' }));
  normalized.propAssets = (Array.isArray(normalized.propAssets) ? normalized.propAssets : []).map((a) => ({ ...a, imageUrl: a.imageUrl || ((a as any).imageUrls || [])[0] || '' }));
  if (normalized.seedanceRules.includes('15 秒分段') || normalized.seedanceRules.includes('15秒分段')) {
    normalized.seedanceRules = normalized.seedanceRules.replace(/15\s*秒分段/g, '10 秒项目段落');
  }
  return normalized;
}

function inferShotStatus(raw: Partial<Shot>): ShotStatus {
  if (raw.status) return raw.status;
  if (raw.endFrameUrl) return 'endframe_locked';
  if (raw.reviewStatus === 'approved') return 'approved';
  if (raw.reviewStatus === 'rejected' || (raw.failureDimensions || []).length > 0) return 'needs_repair';
  if (raw.videoUrl) return 'review';
  if (raw.prompt) return 'ready';
  return 'draft';
}

function normalizeKeyframe(raw: Partial<ShotKeyframe>, index = 0): ShotKeyframe {
  return {
    id: raw.id || genKeyframeId(),
    index: typeof raw.index === 'number' ? raw.index : index,
    timeSec: typeof raw.timeSec === 'number' ? raw.timeSec : index,
    prompt: raw.prompt || '',
    imageUrl: raw.imageUrl || '',
    videoUrl: raw.videoUrl,
  };
}

function normalizeShot(raw: Partial<Shot>, order = 0): Shot {
  const hasKeyframes = Array.isArray(raw.keyframes) && raw.keyframes.some((keyframe) => keyframe?.imageUrl);
  const inferredGenerationMode: ShotGenerationMode = raw.imageUrl ? 'sheet' : hasKeyframes ? 'keyframes' : 'text';
  const generationMode = raw.generationMode === 'text' || raw.generationMode === 'keyframes' || raw.generationMode === 'sheet' ? raw.generationMode : inferredGenerationMode;
  const duration = typeof raw.duration === 'number' && raw.duration > 0 ? raw.duration : 4;
  return {
    id: raw.id || genId(),
    order: typeof raw.order === 'number' ? raw.order : order,
    prompt: raw.prompt || '',
    imageUrl: raw.imageUrl || '',
    keyframes: Array.isArray(raw.keyframes) ? raw.keyframes.map((keyframe, index) => normalizeKeyframe(keyframe, index)) : [],
    videoUrl: raw.videoUrl,
    generationMode,
    duration,
    style: (raw.style || 'realistic') as VideoStyle,
    resolution: (raw.resolution || '1080p') as Resolution,
    frameRate: (raw.frameRate || 24) as FrameRate,
    shotType: raw.shotType || '中景',
    cameraMove: raw.cameraMove || '固定',
    lighting: raw.lighting || '自然光',
    colorTone: raw.colorTone || '胶片感',
    subject: raw.subject || '',
    scene: raw.scene || '',
    notes: raw.notes || '',
    status: inferShotStatus(raw),
    narrativeFunction: raw.narrativeFunction || '',
    directorIntent: raw.directorIntent || '',
    emotionalShift: raw.emotionalShift || '',
    visualFocus: raw.visualFocus || '',
    actionStart: raw.actionStart || '',
    actionEnd: raw.actionEnd || '',
    previousRelation: raw.previousRelation || '',
    nextRelation: raw.nextRelation || '',
    spatialLock: raw.spatialLock || '',
    diagnosis: raw.diagnosis || '',
    diagnosisNotes: raw.diagnosisNotes || '',
    negativePrompt: raw.negativePrompt || '',
    reviewStatus: raw.reviewStatus || 'pending',
    failureDimensions: Array.isArray(raw.failureDimensions) ? raw.failureDimensions : [],
    repairPrompt: raw.repairPrompt || '',
    repairNotes: raw.repairNotes || '',
    endFrameUrl: raw.endFrameUrl || '',
    handoffNote: raw.handoffNote || '',
  };
}

function normalizeRecord(raw: Partial<ProjectRecord>): ProjectRecord {
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : Date.now();
  const record: ProjectRecord = {
    id: raw.id || genRecordId(),
    title: raw.title,
    scriptContent: raw.scriptContent || '',
    shots: Array.isArray(raw.shots) ? raw.shots.map((shot, index) => normalizeShot(shot, index)) : [],
    videoUrl: raw.videoUrl,
    createdAt,
    productionStage: raw.productionStage || 'creative',
    projectBible: normalizeProjectBible(raw.projectBible),
  };
  return { ...record, title: projectTitle(record) };
}

function migratePersistedState(persisted: unknown): Partial<AppState> {
  if (!persisted || typeof persisted !== 'object') return {};
  const state = persisted as Partial<AppState>;
  const historyFilter = state.historyFilter === 'withVideo' || state.historyFilter === 'noVideo' ? state.historyFilter : 'all';
  return {
    ...state,
    rememberKey: Boolean(state.rememberKey),
    rememberWorkspace: state.rememberWorkspace ?? true,
    defaultShotMode: state.defaultShotMode === 'text' || state.defaultShotMode === 'keyframes' || state.defaultShotMode === 'sheet' ? state.defaultShotMode : 'text',
    projectTitle: state.projectTitle || '未命名项目',
    productionStage: state.productionStage || 'creative',
    projectBible: normalizeProjectBible(state.projectBible),
    shots: Array.isArray(state.shots) ? state.shots.map((shot, index) => normalizeShot(shot, index)) : [],
    projectRecords: Array.isArray(state.projectRecords) ? state.projectRecords.map(normalizeRecord).slice(0, 200) : [],
    taskQueue: Array.isArray(state.taskQueue) ? state.taskQueue.filter((task) => task.status !== 'running' && task.status !== 'queued').slice(-100) : [],
    historyFilter,
    historyPage: typeof state.historyPage === 'number' && state.historyPage > 0 ? state.historyPage : 1,
    toasts: [],
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      videoApiKey: '',
      videoApiBaseUrl: '',
      selectedVideoModel: '',
      imageApiKey: '',
      imageApiBaseUrl: '',
      selectedImageModel: 'dall-e-3',
      textApiKey: '',
      textApiBaseUrl: '',
      selectedTextModel: 'gpt-4o-mini',
      rememberKey: false,
      rememberWorkspace: true,

      ossAccessKey: '',
      ossAccessSecret: '',
      ossBucket: '',
      ossRegion: '',
      ossEndpoint: '',
      ossCustomDomain: '',

      projectTitle: '未命名项目',
      productionStage: 'creative' as ProductionStageKey,
      projectBible: DEFAULT_PROJECT_BIBLE,
      activeMode: 'script2shots' as CreationMode,
      defaultShotMode: 'text' as ShotGenerationMode,
      scriptContent: '',
      scriptInputMode: 'text' as ScriptInputMode,
      shots: [] as Shot[],
      selectedStyle: 'realistic' as VideoStyle,
      defaultResolution: '1080p' as Resolution,
      defaultFrameRate: 24 as FrameRate,
      defaultDuration: 10,
      imageSize: '1792x1024',
      videoSize: '1920x1080',

      taskQueue: [] as VideoTask[],
      projectRecords: [] as ProjectRecord[],
      historyFilter: 'all',
      historySearch: '',
      historyPage: 1,

      theme: 'light' as 'light' | 'dark',
      leftPanelWidth: 280,
      rightPanelWidth: 340,
      toasts: [],

      user: null,
      authStatus: 'checking',
      authUser: null,
      token: '',
      phpApiUrl: 'http://localhost:8000',

      setVideoApiKey: (k) => set({ videoApiKey: k }),
      setVideoApiBaseUrl: (u) => set({ videoApiBaseUrl: u }),
      setSelectedVideoModel: (m) => set({ selectedVideoModel: m }),
      setImageApiKey: (k) => set({ imageApiKey: k }),
      setImageApiBaseUrl: (u) => set({ imageApiBaseUrl: u }),
      setSelectedImageModel: (m) => set({ selectedImageModel: m }),
      setTextApiKey: (k) => set({ textApiKey: k }),
      setTextApiBaseUrl: (u) => set({ textApiBaseUrl: u }),
      setSelectedTextModel: (m) => set({ selectedTextModel: m }),
      setRememberKey: (v) => set({ rememberKey: v }),
      setRememberWorkspace: (v) => set({ rememberWorkspace: v }),

      setOssAccessKey: (k) => set({ ossAccessKey: k }),
      setOssAccessSecret: (k) => set({ ossAccessSecret: k }),
      setOssBucket: (k) => set({ ossBucket: k }),
      setOssRegion: (k) => set({ ossRegion: k }),
      setOssEndpoint: (k) => set({ ossEndpoint: k }),
      setOssCustomDomain: (k) => set({ ossCustomDomain: k }),

      setProjectTitle: (title) => set({ projectTitle: title }),
      setProductionStage: (stage) => set({ productionStage: stage }),
      updateProjectBible: (patch) => set((st) => ({ projectBible: normalizeProjectBible({ ...st.projectBible, ...patch }) })),
      addAsset: (type, asset) => set((st) => ({ projectBible: { ...st.projectBible, [type]: [...st.projectBible[type], asset] } })),
      removeAsset: (type, id) => set((st) => ({ projectBible: { ...st.projectBible, [type]: st.projectBible[type].filter((a) => a.id !== id) } })),
      updateAsset: (type, id, patch) => set((st) => ({ projectBible: { ...st.projectBible, [type]: st.projectBible[type].map((a) => a.id === id ? { ...a, ...patch } : a) } })),
      setActiveMode: (m) => set({ activeMode: m }),
      setDefaultShotMode: (m) => set({ defaultShotMode: m }),
      setScriptContent: (c) => set({ scriptContent: c }),
      setScriptInputMode: (m) => set({ scriptInputMode: m }),
      setShots: (s) => set({ shots: s.map((shot, index) => normalizeShot(shot, index)) }),
      addShot: (s) => set((st) => ({ shots: [...st.shots, normalizeShot({ ...s, id: s.id || genId() }, st.shots.length)] })),
      updateShot: (id, patch) => set((st) => ({ shots: st.shots.map((s) => (s.id === id ? normalizeShot({ ...s, ...patch }, s.order) : s)) })),
      removeShot: (id) => set((st) => ({ shots: st.shots.filter((s) => s.id !== id) })),
      setSelectedStyle: (s) => set({ selectedStyle: s }),
      setDefaultResolution: (r) => set({ defaultResolution: r }),
      setDefaultFrameRate: (f) => set({ defaultFrameRate: f }),
      setDefaultDuration: (d) => set({ defaultDuration: d }),
      setImageSize: (s) => set({ imageSize: s }),
      setVideoSize: (s) => set({ videoSize: s }),

      addTask: (t) => set((st) => ({ taskQueue: [...st.taskQueue, { ...t, id: t.id || genTaskId() }].slice(-100) })),
      updateTask: (id, patch) => set((st) => ({ taskQueue: st.taskQueue.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      clearTasks: () => set({ taskQueue: [] }),
      addProjectRecord: (r) => set((st) => ({ projectRecords: [normalizeRecord({ ...r, id: r.id || genRecordId(), title: r.title || st.projectTitle, productionStage: st.productionStage, projectBible: st.projectBible }), ...st.projectRecords].slice(0, 200) })),
      updateProjectRecord: (id, patch) => set((st) => ({ projectRecords: st.projectRecords.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      removeProjectRecord: (id) => set((st) => ({ projectRecords: st.projectRecords.filter((r) => r.id !== id) })),
      clearProjectRecords: () => set({ projectRecords: [] }),
      importProjectRecords: (records) => set((st) => ({ projectRecords: [...records.map(normalizeRecord), ...st.projectRecords].slice(0, 200), historyPage: 1 })),
      setHistoryFilter: (f) => set({ historyFilter: f, historyPage: 1 }),
      setHistorySearch: (s) => set({ historySearch: s, historyPage: 1 }),
      setHistoryPage: (p) => set({ historyPage: p }),

      toggleTheme: () => set((st) => ({ theme: st.theme === 'light' ? 'dark' : 'light' })),
      setLeftPanelWidth: (w) => set({ leftPanelWidth: w }),
      setRightPanelWidth: (w) => set({ rightPanelWidth: w }),
      addToast: (toast) => set((st) => ({ toasts: [...st.toasts, { ...toast, id: genToastId() }].slice(-4) })),
      dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((toast) => toast.id !== id) })),

      setUser: (u) => set({ user: u }),
      setAuthStatus: (s) => set({ authStatus: s }),
      setAuthUser: (u) => set({ authUser: u, user: u }),
      setToken: (t) => set({ token: t }),
      setPhpApiUrl: (url) => set({ phpApiUrl: url }),
      applyServerSettings: (settings) => {
        const s: Record<string, string> = {};
        Object.entries(settings).forEach(([k, v]) => { s[k] = v; });
        set(s as any);
      },
      logout: () => set({ user: null, authUser: null, authStatus: 'guest', token: '' }),

      showLoginModal: false,
      setShowLoginModal: (v) => set({ showLoginModal: v }),
    }),
    {
      name: 'video-studio',
      version: STORE_VERSION,
      migrate: (persisted) => migratePersistedState(persisted) as never,
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) console.error('[video-studio] 数据恢复失败:', error);
        };
      },
      partialize: (state) => ({
        videoApiKey: state.rememberKey ? state.videoApiKey : '',
        videoApiBaseUrl: state.rememberKey ? state.videoApiBaseUrl : '',
        selectedVideoModel: state.selectedVideoModel,
        imageApiKey: state.rememberKey ? state.imageApiKey : '',
        imageApiBaseUrl: state.rememberKey ? state.imageApiBaseUrl : '',
        selectedImageModel: state.selectedImageModel,
        textApiKey: state.rememberKey ? state.textApiKey : '',
        textApiBaseUrl: state.rememberKey ? state.textApiBaseUrl : '',
        selectedTextModel: state.selectedTextModel,
        rememberKey: state.rememberKey,
        rememberWorkspace: state.rememberWorkspace,
        ossAccessKey: state.rememberKey ? state.ossAccessKey : '',
        ossAccessSecret: state.rememberKey ? state.ossAccessSecret : '',
        ossBucket: state.ossBucket,
        ossRegion: state.ossRegion,
        ossEndpoint: state.ossEndpoint,
        ossCustomDomain: state.ossCustomDomain,
        projectTitle: state.rememberWorkspace ? state.projectTitle : '未命名项目',
        productionStage: state.rememberWorkspace ? state.productionStage : 'creative',
        projectBible: state.rememberWorkspace ? state.projectBible : DEFAULT_PROJECT_BIBLE,
        projectRecords: state.rememberWorkspace ? state.projectRecords : [],
        shots: state.rememberWorkspace ? state.shots : [],
        scriptContent: state.rememberWorkspace ? state.scriptContent : '',
        imageSize: state.imageSize,
        videoSize: state.videoSize,
        defaultShotMode: state.defaultShotMode,
        selectedStyle: state.selectedStyle,
        defaultResolution: state.defaultResolution,
        defaultFrameRate: state.defaultFrameRate,
        defaultDuration: state.defaultDuration,
        theme: state.theme,
        user: state.user,
        token: state.token,
        phpApiUrl: state.phpApiUrl,
        leftPanelWidth: state.leftPanelWidth,
        rightPanelWidth: state.rightPanelWidth,
      }),
      merge: (persisted, current) => {
        try {
          const merged = { ...current, ...(persisted as Partial<AppState>) };
          const persistedBible = (persisted as any)?.projectBible;
          if (persistedBible) {
            const currentBible = current.projectBible;
            const mergedBible: ProjectBible = { ...currentBible, ...persistedBible };
            if (!persistedBible.characterAssets?.length && currentBible.characterAssets?.length) mergedBible.characterAssets = currentBible.characterAssets;
            if (!persistedBible.sceneAssets?.length && currentBible.sceneAssets?.length) mergedBible.sceneAssets = currentBible.sceneAssets;
            if (!persistedBible.propAssets?.length && currentBible.propAssets?.length) mergedBible.propAssets = currentBible.propAssets;
            merged.projectBible = normalizeProjectBible(mergedBible);
          }
          return merged;
        }
        catch { return current; }
      },
    }
  )
);
