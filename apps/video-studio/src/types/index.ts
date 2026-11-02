// ==================== 模式 ====================
export type CreationMode = 'text2video' | 'image2video' | 'script2shots';
export type ShotGenerationMode = 'text' | 'keyframes' | 'sheet';
export type ProductionStageKey = 'creative' | 'diagnosis' | 'director' | 'art' | 'space' | 'storyboard' | 'prompt' | 'review' | 'repair' | 'endframe' | 'post' | 'publish';
export type ShotStatus = 'draft' | 'planned' | 'needs_rules' | 'ready' | 'generating' | 'review' | 'approved' | 'needs_repair' | 'repairing' | 'endframe_locked' | 'archived';
export type FailureDimension = 'identity' | 'hands' | 'position' | 'space' | 'lighting' | 'camera' | 'motion' | 'endframe' | 'artifact';

// ==================== 风格预设 ====================
export type VideoStyle = 'realistic' | 'anime' | 'cinematic' | 'cyberpunk' | 'documentary' | 'music-video';

export const VIDEO_STYLES: { key: VideoStyle; label: string }[] = [
  { key: 'realistic', label: '电影写实' },
  { key: 'anime', label: '动漫' },
  { key: 'cinematic', label: '纪录片' },
  { key: 'cyberpunk', label: '赛博朋克' },
  { key: 'documentary', label: '纪实' },
  { key: 'music-video', label: 'MV风格' },
];

export const SHOT_TYPES = ['远景', '全景', '中景', '近景', '特写', '航拍', '主观镜头'] as const;
export const CAMERA_MOVES = ['固定', '推镜', '拉镜', '摇镜', '移镜', '跟拍', '环绕', '手持'] as const;
export const LIGHTING_PRESETS = ['自然光', '柔光', '硬光', '低调光', '逆光', '霓虹光', '烛光'] as const;
export const COLOR_TONES = ['冷色', '暖色', '高对比', '低饱和', '胶片感', '黑白', '赛博霓虹'] as const;

export const PRODUCTION_STAGES: { key: ProductionStageKey; no: string; label: string; short: string }[] = [
  { key: 'creative', no: '01', label: '创意输入', short: '创意' },
  { key: 'diagnosis', no: '02', label: '剧本诊断', short: '诊断' },
  { key: 'director', no: '03', label: '导演拆解', short: '导演' },
  { key: 'art', no: '04', label: '美术圣经', short: '美术' },
  { key: 'space', no: '05', label: '空间锁定', short: '空间' },
  { key: 'storyboard', no: '06', label: '分镜运镜', short: '分镜' },
  { key: 'prompt', no: '07', label: 'Seedance 提示词', short: '提示词' },
  { key: 'review', no: '08', label: '抽卡验收', short: '验收' },
  { key: 'repair', no: '09', label: '局部修复', short: '修复' },
  { key: 'endframe', no: '10', label: '结尾帧锁定', short: '结尾帧' },
  { key: 'post', no: '11', label: '衔接剪辑声音', short: '后期' },
  { key: 'publish', no: '12', label: '后期发布入库', short: '入库' },
];

export const SHOT_STATUS_LABELS: Record<ShotStatus, string> = {
  draft: '未拆解',
  planned: '已拆解',
  needs_rules: '待补规则',
  ready: '待生成',
  generating: '生成中',
  review: '待验收',
  approved: '已通过',
  needs_repair: '需修复',
  repairing: '修复中',
  endframe_locked: '结尾帧锁定',
  archived: '已入库',
};

export const FAILURE_DIMENSION_LABELS: Record<FailureDimension, string> = {
  identity: '人物不像',
  hands: '手部错误',
  position: '位置错误',
  space: '空间关系',
  lighting: '光影错误',
  camera: '运镜错误',
  motion: '动作不顺',
  endframe: '结尾不可接',
  artifact: '文字水印畸形',
};

export type Resolution = '720p' | '1080p' | '4k';
export const RESOLUTIONS: Resolution[] = ['720p', '1080p', '4k'];

export type FrameRate = 24 | 30 | 60;
export const FRAME_RATES: FrameRate[] = [24, 30, 60];

export type ScriptInputMode = 'text' | 'file' | 'image';
export type ToastKind = 'success' | 'error' | 'info';

// ==================== 分镜 ====================
export interface ShotKeyframe {
  id: string;
  index: number;
  timeSec: number;
  prompt: string;
  imageUrl: string;
  videoUrl?: string;
}

export interface Shot {
  id: string;
  order: number;
  prompt: string;
  imageUrl: string;
  keyframes: ShotKeyframe[];
  videoUrl?: string;
  generationMode: ShotGenerationMode;
  duration: number;
  style: VideoStyle;
  resolution: Resolution;
  frameRate: FrameRate;
  shotType?: string;
  cameraMove?: string;
  lighting?: string;
  colorTone?: string;
  subject?: string;
  scene?: string;
  notes?: string;
  status: ShotStatus;
  narrativeFunction?: string;
  directorIntent?: string;
  emotionalShift?: string;
  visualFocus?: string;
  actionStart?: string;
  actionEnd?: string;
  previousRelation?: string;
  nextRelation?: string;
  spatialLock?: string;
  diagnosis?: string;
  diagnosisNotes?: string;
  negativePrompt?: string;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  failureDimensions?: FailureDimension[];
  repairPrompt?: string;
  repairNotes?: string;
  endFrameUrl?: string;
  handoffNote?: string;
}

export interface AssetItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface ProjectBible {
  characters: string;
  scenes: string;
  props: string;
  characterAssets: AssetItem[];
  sceneAssets: AssetItem[];
  propAssets: AssetItem[];
  styleRules: string;
  colorRules: string;
  spatialRules: string;
  negativeRules: string;
  seedanceRules: string;
  diagnosisNotes: string;
  postNotes: string;
}

// ==================== 任务 ====================
export interface VideoTask {
  id: string;
  shotId: string;
  keyframeId?: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
  prompt: string;
  imageUrl?: string;
  keyframeUrls?: string[];
  videoUrl?: string;
  error?: string;
  duration?: number;
  createdAt: number;
}

// ==================== 项目记录（完整保存） ====================
export interface ProjectRecord {
  id: string;
  title?: string;
  scriptContent: string;
  shots: Shot[];
  videoUrl?: string;
  createdAt: number;
  productionStage?: ProductionStageKey;
  projectBible?: ProjectBible;
}

// ==================== 通知 ====================
export interface ToastNotice {
  id: string;
  kind: ToastKind;
  message: string;
}

// ==================== Store ====================
export interface AppState {
  videoApiKey: string;
  videoApiBaseUrl: string;
  selectedVideoModel: string;
  imageApiKey: string;
  imageApiBaseUrl: string;
  selectedImageModel: string;
  textApiKey: string;
  textApiBaseUrl: string;
  selectedTextModel: string;
  rememberKey: boolean;
  rememberWorkspace: boolean;

  ossAccessKey: string;
  ossAccessSecret: string;
  ossBucket: string;
  ossRegion: string;
  ossEndpoint: string;
  ossCustomDomain: string;

  projectTitle: string;
  productionStage: ProductionStageKey;
  projectBible: ProjectBible;
  activeMode: CreationMode;
  defaultShotMode: ShotGenerationMode;
  scriptContent: string;
  scriptInputMode: ScriptInputMode;
  shots: Shot[];
  selectedStyle: VideoStyle;
  defaultResolution: Resolution;
  defaultFrameRate: FrameRate;
  defaultDuration: number;
  imageSize: string;
  videoSize: string;

  taskQueue: VideoTask[];
  projectRecords: ProjectRecord[];
  historyFilter: 'all' | 'withVideo' | 'noVideo';
  historySearch: string;
  historyPage: number;

  theme: 'light' | 'dark';
  leftPanelWidth: number;
  rightPanelWidth: number;
  toasts: ToastNotice[];

  user: { id: number; username: string } | null;
  authStatus: 'checking' | 'guest' | 'authenticated';
  authUser: { id: number; username: string } | null;
  token: string;
  phpApiUrl: string;
  setUser: (u: { id: number; username: string } | null) => void;
  setAuthStatus: (s: 'checking' | 'guest' | 'authenticated') => void;
  setAuthUser: (u: { id: number; username: string } | null) => void;
  setToken: (t: string) => void;
  setPhpApiUrl: (url: string) => void;
  applyServerSettings: (settings: Record<string, string>) => void;
  logout: () => void;
  showLoginModal: boolean;
  setShowLoginModal: (v: boolean) => void;

  setVideoApiKey: (k: string) => void;
  setVideoApiBaseUrl: (u: string) => void;
  setSelectedVideoModel: (m: string) => void;
  setImageApiKey: (k: string) => void;
  setImageApiBaseUrl: (u: string) => void;
  setSelectedImageModel: (m: string) => void;
  setTextApiKey: (k: string) => void;
  setTextApiBaseUrl: (u: string) => void;
  setSelectedTextModel: (m: string) => void;
  setRememberKey: (v: boolean) => void;
  setRememberWorkspace: (v: boolean) => void;

  setOssAccessKey: (k: string) => void;
  setOssAccessSecret: (k: string) => void;
  setOssBucket: (k: string) => void;
  setOssRegion: (k: string) => void;
  setOssEndpoint: (k: string) => void;
  setOssCustomDomain: (k: string) => void;

  setProjectTitle: (title: string) => void;
  setProductionStage: (stage: ProductionStageKey) => void;
  updateProjectBible: (patch: Partial<ProjectBible>) => void;
  addAsset: (type: 'characterAssets' | 'sceneAssets' | 'propAssets', asset: AssetItem) => void;
  removeAsset: (type: 'characterAssets' | 'sceneAssets' | 'propAssets', id: string) => void;
  updateAsset: (type: 'characterAssets' | 'sceneAssets' | 'propAssets', id: string, patch: Partial<AssetItem>) => void;
  setActiveMode: (m: CreationMode) => void;
  setDefaultShotMode: (m: ShotGenerationMode) => void;
  setScriptContent: (c: string) => void;
  setScriptInputMode: (m: ScriptInputMode) => void;
  setShots: (s: Shot[]) => void;
  addShot: (s: Shot) => void;
  updateShot: (id: string, patch: Partial<Shot>) => void;
  removeShot: (id: string) => void;
  setSelectedStyle: (s: VideoStyle) => void;
  setDefaultResolution: (r: Resolution) => void;
  setDefaultFrameRate: (f: FrameRate) => void;
  setDefaultDuration: (d: number) => void;
  setImageSize: (s: string) => void;
  setVideoSize: (s: string) => void;

  addTask: (t: VideoTask) => void;
  updateTask: (id: string, patch: Partial<VideoTask>) => void;
  clearTasks: () => void;
  addProjectRecord: (r: ProjectRecord) => void;
  updateProjectRecord: (id: string, patch: Partial<ProjectRecord>) => void;
  removeProjectRecord: (id: string) => void;
  clearProjectRecords: () => void;
  importProjectRecords: (records: ProjectRecord[]) => void;
  setHistoryFilter: (f: 'all' | 'withVideo' | 'noVideo') => void;
  setHistorySearch: (s: string) => void;
  setHistoryPage: (p: number) => void;

  toggleTheme: () => void;
  setLeftPanelWidth: (w: number) => void;
  setRightPanelWidth: (w: number) => void;
  addToast: (toast: Omit<ToastNotice, 'id'>) => void;
  dismissToast: (id: string) => void;
}

export interface AuthUser {
  id: number;
  username: string;
  isAdmin?: boolean;
}

export interface ScriptGenRequest {
  input: string;
  mode: ScriptInputMode;
  style: VideoStyle;
}

export interface ShotBreakdownRequest {
  script: string;
  shotCount: number;
  style: VideoStyle;
}
