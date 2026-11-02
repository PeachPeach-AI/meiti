import type { AppState, AuthUser } from '@/types';

type ApiEnvelope<T> = T & {
  success: boolean;
  message?: string;
};

export type ScriptFlowSettings = Record<string, string>;

const DEFAULT_API_BASE = '/api/auth/local';

function apiBase() {
  return (process.env.NEXT_PUBLIC_SCRIPTFLOW_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');
}

function resourceUrl(resource: 'auth' | 'settings', action?: string) {
  const base = apiBase();
  const url = new URL(base, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  if (action) url.searchParams.set('action', action);
  return url.pathname + url.search;
}

function normalizeUser(user: any): AuthUser {
  return {
    id: Number(user?.id ?? 0),
    username: user?.username || '用户',
    isAdmin: Boolean(user?.is_admin ?? user?.isAdmin),
  };
}

async function request<T>(resource: 'auth' | 'settings', options: { action?: string; method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body) headers['Content-Type'] = 'application/json';
  // 发送本地 token
  try {
    const { useAppStore } = await import('@/store');
    const t = useAppStore.getState().token;
    if (t) headers['Authorization'] = `Bearer ${t}`;
  } catch {}

  const res = await fetch(resourceUrl(resource, options.action), {
    method: options.method || 'GET',
    credentials: 'include',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : { success: false, message: await res.text().catch(() => '') };

  if (!res.ok || data.success === false) {
    throw new Error(data.message || `请求失败 (${res.status})`);
  }

  return data as T;
}

export async function getCurrentUser() {
  const data = await request<ApiEnvelope<{ user: any }>>('auth', { action: 'me' });
  return normalizeUser(data.user);
}

export async function loginToScriptFlow(username: string, password: string) {
  const data = await request<ApiEnvelope<{ user: any }>>('auth', {
    action: 'login',
    method: 'POST',
    body: { username, password },
  });
  return normalizeUser(data.user);
}

export async function registerToScriptFlow(username: string, email: string, password: string) {
  const data = await request<ApiEnvelope<{ user: any }>>('auth', {
    action: 'register',
    method: 'POST',
    body: { username, email, password },
  });
  return normalizeUser(data.user);
}

export async function logoutFromScriptFlow() {
  await request<ApiEnvelope<{}>>('auth', { action: 'logout', method: 'POST', body: {} });
}

export async function fetchUserSettings(): Promise<ScriptFlowSettings> {
  const data = await request<ApiEnvelope<{ settings: ScriptFlowSettings }>>('auth', { action: 'load_settings' });
  return data.settings || {};
}

export async function saveUserSettings(settings: ScriptFlowSettings, token: string) {
  await request<ApiEnvelope<{}>>('auth', { action: 'save_settings', method: 'POST', body: { settings, token } });
}

export function mapServerSettingsToStore(settings: ScriptFlowSettings): Partial<AppState> {
  return {
    videoApiKey: settings.video_api_key ?? '',
    videoApiBaseUrl: settings.video_endpoint ?? '',
    selectedVideoModel: settings.video_model ?? '',
    textApiKey: settings.ai_api_key ?? '',
    textApiBaseUrl: settings.ai_endpoint ?? '',
    selectedTextModel: settings.ai_model ?? '',
    imageApiKey: settings.img_api_key ?? '',
    imageApiBaseUrl: settings.img_endpoint ?? '',
    selectedImageModel: settings.img_model ?? '',
    ossAccessKey: settings.oss_access_key ?? '',
    ossAccessSecret: settings.oss_access_secret ?? '',
    ossBucket: settings.oss_bucket ?? '',
    ossEndpoint: settings.oss_endpoint ?? '',
    ossRegion: settings.oss_region ?? '',
    ossCustomDomain: settings.oss_custom_domain ?? '',
  };
}

export function collectServerSettings(state: AppState): ScriptFlowSettings {
  return {
    video_api_key: state.videoApiKey,
    video_endpoint: state.videoApiBaseUrl,
    video_model: state.selectedVideoModel,
    ai_api_key: state.textApiKey,
    ai_endpoint: state.textApiBaseUrl,
    ai_model: state.selectedTextModel,
    img_api_key: state.imageApiKey,
    img_endpoint: state.imageApiBaseUrl,
    img_model: state.selectedImageModel,
    oss_access_key: state.ossAccessKey,
    oss_access_secret: state.ossAccessSecret,
    oss_bucket: state.ossBucket,
    oss_endpoint: state.ossEndpoint,
    oss_region: state.ossRegion,
    oss_custom_domain: state.ossCustomDomain,
  };
}
