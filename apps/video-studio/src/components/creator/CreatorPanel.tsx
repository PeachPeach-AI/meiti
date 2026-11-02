'use client';
import { useState, useRef, useEffect } from 'react';
import { Copy, Trash2, Upload, RefreshCw, Play, List, Clock, CheckCircle, AlertCircle, Loader2, XCircle, Images, ImageOff, Download, Wrench, ShieldCheck, Link2, GripVertical, X, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import type { AssetItem, FailureDimension, Shot, ShotGenerationMode, ShotKeyframe } from '@/types';
import { CAMERA_MOVES, COLOR_TONES, FAILURE_DIMENSION_LABELS, LIGHTING_PRESETS, PRODUCTION_STAGES, SHOT_STATUS_LABELS, SHOT_TYPES } from '@/types';
import { fileToBase64 } from '@/lib/utils';
import { autoPlanProject, composeShotPrompt, composeVideoPrompt, generateImage, generateKeyframeSheet, generateScript, breakdownScript, generateVideo, primaryReferenceImage, referenceImageUrls } from '@/lib/api';

const SHOT_GENERATION_MODES: { value: ShotGenerationMode; label: string; hint: string }[] = [
  { value: 'text', label: '纯文本', hint: '只复制镜头提示词' },
  { value: 'keyframes', label: '关键帧', hint: '逐张上传参考图' },
  { value: 'sheet', label: '组图切割', hint: '一张组图自动切帧' },
];


function shotModeLabel(mode: ShotGenerationMode) {
  return SHOT_GENERATION_MODES.find((item) => item.value === mode)?.label || '组图切割';
}

const AUTO_PLAN_TOTAL_DURATION = 10;

function distributeTenSecondDurations(count: number): number[] {
  const safeCount = Math.max(1, count);
  if (safeCount > AUTO_PLAN_TOTAL_DURATION) return Array.from({ length: safeCount }, () => 1);
  const base = Math.floor(AUTO_PLAN_TOTAL_DURATION / safeCount);
  const remainder = AUTO_PLAN_TOTAL_DURATION - base * safeCount;
  return Array.from({ length: safeCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function normalizeAutoPlanDurations(items: Array<{ duration?: number }>): number[] {
  const durations = items.map((item) => Number(item.duration)).filter((duration) => Number.isFinite(duration) && duration > 0);
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  if (durations.length === items.length && Math.abs(total - AUTO_PLAN_TOTAL_DURATION) < 0.1) {
    return durations.map((duration) => Math.max(1, Math.round(duration)));
  }
  return distributeTenSecondDurations(items.length);
}

function newShotBase(order: number, store: ReturnType<typeof useAppStore.getState>): Shot {
  return {
    id: '',
    order,
    prompt: '',
    imageUrl: '',
    keyframes: [],
    generationMode: store.defaultShotMode,
    duration: store.defaultDuration,
    style: store.selectedStyle,
    resolution: store.defaultResolution,
    frameRate: store.defaultFrameRate,
    shotType: '中景',
    cameraMove: '固定',
    lighting: '自然光',
    colorTone: '胶片感',
    subject: '',
    scene: '',
    notes: '',
    status: 'draft',
    narrativeFunction: '',
    directorIntent: '',
    emotionalShift: '',
    visualFocus: '',
    actionStart: '',
    actionEnd: '',
    previousRelation: '',
    nextRelation: '',
    spatialLock: '',
    negativePrompt: store.projectBible.negativeRules,
    reviewStatus: 'pending',
    failureDimensions: [],
    repairPrompt: '',
    repairNotes: '',
    endFrameUrl: '',
    handoffNote: '',
  };
}

export function ScriptInput() {
  const scriptContent = useAppStore((s) => s.scriptContent);
  const scriptInputMode = useAppStore((s) => s.scriptInputMode);
  const textApiKey = useAppStore((s) => s.textApiKey);
  const textApiBaseUrl = useAppStore((s) => s.textApiBaseUrl);
  const selectedTextModel = useAppStore((s) => s.selectedTextModel);
  const selectedStyle = useAppStore((s) => s.selectedStyle);
  const defaultResolution = useAppStore((s) => s.defaultResolution);
  const defaultFrameRate = useAppStore((s) => s.defaultFrameRate);
  const defaultDuration = useAppStore((s) => s.defaultDuration);
  const defaultShotMode = useAppStore((s) => s.defaultShotMode);
  const setScriptContent = useAppStore((s) => s.setScriptContent);
  const setScriptInputMode = useAppStore((s) => s.setScriptInputMode);
  const setProjectTitle = useAppStore((s) => s.setProjectTitle);
  const setProductionStage = useAppStore((s) => s.setProductionStage);
  const updateProjectBible = useAppStore((s) => s.updateProjectBible);
  const setShots = useAppStore((s) => s.setShots);
  const addToast = useAppStore((s) => s.addToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [shotCount, setShotCount] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [localContent, setLocalContent] = useState(scriptContent);
  const syncTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setLocalContent(scriptContent); }, [scriptContent]);

  const handleContentChange = (val: string) => {
    if (scriptInputMode !== 'text') setScriptInputMode('text');
    setLocalContent(val);
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => setScriptContent(val), 300);
  };

  const clearScriptInput = () => {
    setScriptInputMode('text');
    setScriptContent('');
    setLocalContent('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.type.startsWith('image/')) {
        setScriptInputMode('image');
        const b64 = await fileToBase64(file);
        setScriptContent(b64);
        setLocalContent('[图片已加载]');
        addToast({ kind: 'success', message: '图片已加载，可用于生成剧本。' });
      } else {
        setScriptInputMode('file');
        const text = await file.text();
        setScriptContent(text);
        setLocalContent(text);
        addToast({ kind: 'success', message: '文件内容已载入。' });
      }
    } catch (e) {
      addToast({ kind: 'error', message: '文件读取失败：' + (e as Error).message });
    } finally {
      e.target.value = '';
    }
  };

  const handleGenerateScript = async () => {
    if (!textApiKey || !textApiBaseUrl || !selectedTextModel || !scriptContent) return;
    setGenerating(true);
    try {
      const script = await generateScript(scriptContent, scriptInputMode, selectedStyle, textApiBaseUrl, textApiKey, selectedTextModel);
      setScriptContent(script);
      setLocalContent(script);
      addToast({ kind: 'success', message: '剧本已生成。' });
    } catch (e) {
      addToast({ kind: 'error', message: '生成失败：' + (e as Error).message });
    } finally {
      setGenerating(false);
    }
  };

  const handleBreakdown = async () => {
    if (!textApiKey || !textApiBaseUrl || !selectedTextModel || !scriptContent) return;
    if (shotCount < 1) {
      addToast({ kind: 'error', message: '镜头数至少为 1。' });
      return;
    }
    setBreaking(true);
    try {
      const items = await breakdownScript(scriptContent, shotCount, selectedStyle, textApiBaseUrl, textApiKey, selectedTextModel);
      const shots: Shot[] = items.map((item, i) => ({
        id: crypto.randomUUID ? crypto.randomUUID() : 's' + Date.now() + '_' + i,
        order: i,
        prompt: item.prompt,
        imageUrl: '',
        keyframes: [],
        generationMode: defaultShotMode,
        duration: item.duration || defaultDuration,
        style: selectedStyle,
        resolution: defaultResolution,
        frameRate: defaultFrameRate,
        shotType: item.shotType || '中景',
        cameraMove: item.cameraMove || '固定',
        lighting: item.lighting || '自然光',
        colorTone: item.colorTone || '胶片感',
        subject: item.subject || '',
        scene: item.scene || '',
        notes: item.notes || '',
        status: 'ready',
        narrativeFunction: '',
        directorIntent: '',
        emotionalShift: '',
        visualFocus: '',
        actionStart: '',
        actionEnd: '',
        previousRelation: '',
        nextRelation: '',
        spatialLock: '',
        negativePrompt: useAppStore.getState().projectBible.negativeRules,
        reviewStatus: 'pending',
        failureDimensions: [],
        repairPrompt: '',
        repairNotes: '',
        endFrameUrl: '',
        handoffNote: '',
      }));
      setShots(shots);
      addToast({ kind: 'success', message: `已拆解为 ${shots.length} 个镜头。` });
    } catch (e) {
      addToast({ kind: 'error', message: '拆解失败：' + (e as Error).message });
    } finally {
      setBreaking(false);
    }
  };

  const handleAutoPlan = async () => {
    if (!textApiKey || !textApiBaseUrl || !selectedTextModel || !scriptContent) return;
    if (shotCount < 1) {
      addToast({ kind: 'error', message: '镜头数至少为 1。' });
      return;
    }
    setPlanning(true);
    try {
      const plan = await autoPlanProject(scriptContent, scriptInputMode, shotCount, selectedStyle, textApiBaseUrl, textApiKey, selectedTextModel);
      if (plan.title) setProjectTitle(plan.title);
      if (plan.fullScript && scriptContent.trim().length < 100) {
        setScriptContent(plan.fullScript);
        setLocalContent(plan.fullScript);
      }
      updateProjectBible({ ...(plan.projectBible || {}), diagnosisNotes: plan.diagnosisNotes || plan.projectBible?.diagnosisNotes || '' });
      const autoParseAssets = (text: string): AssetItem[] => {
        if (!text) return [];
        return text.split(/[\n；;]/).filter(Boolean).map((line) => {
          const idx = line.indexOf('：') > -1 ? line.indexOf('：') : line.indexOf(':');
          if (idx > 0) return { id: crypto.randomUUID(), name: line.slice(0, idx).trim(), description: line.slice(idx + 1).trim(), imageUrl: '' };
          if (line.trim().length <= 30) return { id: crypto.randomUUID(), name: line.trim(), description: '', imageUrl: '' };
          return null;
        }).filter(Boolean) as AssetItem[];
      };
      const pb = plan.projectBible || {};
      const charAssets = autoParseAssets(pb.characters || '');
      const sceneAssets = autoParseAssets(pb.scenes || '');
      const propAssets = autoParseAssets(pb.props || '');
      if (charAssets.length || sceneAssets.length || propAssets.length) {
        updateProjectBible({ characterAssets: charAssets, sceneAssets, propAssets });
      }
      const plannedDurations = normalizeAutoPlanDurations(plan.shots);
      const shots: Shot[] = plan.shots.map((item, i) => ({
        id: crypto.randomUUID ? crypto.randomUUID() : 's' + Date.now() + '_' + i,
        order: i,
        prompt: item.prompt,
        imageUrl: '',
        keyframes: [],
        generationMode: defaultShotMode,
        duration: plannedDurations[i] || defaultDuration,
        style: selectedStyle,
        resolution: defaultResolution,
        frameRate: defaultFrameRate,
        shotType: item.shotType || '中景',
        cameraMove: item.cameraMove || '固定',
        lighting: item.lighting || '自然光',
        colorTone: item.colorTone || '胶片感',
        subject: item.subject || '',
        scene: item.scene || '',
        notes: item.notes || '',
        status: 'ready',
        narrativeFunction: item.narrativeFunction || '',
        directorIntent: item.directorIntent || '',
        emotionalShift: item.emotionalShift || '',
        visualFocus: item.visualFocus || '',
        actionStart: item.actionStart || '',
        actionEnd: item.actionEnd || '',
        previousRelation: item.previousRelation || '',
        nextRelation: item.nextRelation || '',
        spatialLock: item.spatialLock || '',
        negativePrompt: item.negativePrompt || plan.projectBible?.negativeRules || useAppStore.getState().projectBible.negativeRules,
        diagnosisNotes: item.diagnosisNotes || '',
        reviewStatus: 'pending',
        failureDimensions: [],
        repairPrompt: '',
        repairNotes: '',
        endFrameUrl: '',
        handoffNote: item.handoffNote || '',
      }));
      setShots(shots);
      setProductionStage('storyboard');
      addToast({ kind: 'success', message: `自动规划完成：已生成 ${shots.length} 个镜头和项目规则。` });
    } catch (e) {
      addToast({ kind: 'error', message: '自动规划失败：' + (e as Error).message });
    } finally {
      setPlanning(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-bold text-[var(--app-text)]">剧本</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="w-3 h-3 mr-1" />导入</Button>
          {scriptContent && <Button variant="ghost" size="sm" onClick={clearScriptInput}>清空</Button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*,.txt,.md" className="hidden" onChange={handleFileUpload} />
      </div>
      <textarea
        className="w-full h-24 p-2 text-sm border border-[var(--app-border)] rounded resize-none bg-[var(--app-bg)] text-[var(--app-text)] placeholder-gray-400 focus:outline-none focus:border-[var(--app-primary)]"
        placeholder={scriptInputMode === 'text' ? '输入一句话概念、故事梗概，或直接粘贴完整剧本...' : ''}
        value={scriptInputMode === 'image' ? '[图片已加载]' : localContent}
        onChange={(e) => handleContentChange(e.target.value)}
        disabled={scriptInputMode === 'image'}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400">镜头数:</span>
        <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={shotCount} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setShotCount(v ? Number(v) : 0); }} className="w-16 h-9 px-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text)] text-sm text-center focus:outline-none focus:border-[var(--app-primary)] transition-colors" />
        <Button onClick={handleAutoPlan} disabled={planning || !scriptContent || !textApiKey} size="sm" className="bg-[var(--app-primary)] hover:bg-[var(--app-primary-hover)]">{planning ? '规划中...' : '自动规划项目'}</Button>
        <Button onClick={handleGenerateScript} disabled={generating || planning || !scriptContent || !textApiKey} size="sm" variant="outline">{generating ? '生成中...' : '生成剧本'}</Button>
        <Button onClick={handleBreakdown} disabled={breaking || planning || !scriptContent || !textApiKey} size="sm" variant="outline">{breaking ? '拆解中...' : '拆解为分镜'}</Button>
      </div>
    </div>
  );
}

function TaskOverview() {
  const tasks = useAppStore((s) => s.taskQueue);
  const [open, setOpen] = useState(false);
  if (tasks.length === 0) return null;

  const running = tasks.filter((t) => t.status === 'running').length;
  const done = tasks.filter((t) => t.status === 'success').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        <List className="w-3 h-3 mr-1" />
        任务 ({done}/{tasks.length})
        {running > 0 && <Loader2 className="w-3 h-3 ml-1 animate-spin text-[var(--app-primary)]" />}
        {failed > 0 && <span className="ml-1 rounded bg-red-500/10 px-1 text-[10px] text-red-500">失败 {failed}</span>}
      </Button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-80 max-h-56 overflow-y-auto bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg shadow-lg p-2 z-50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-[var(--app-text)]">任务队列</span>
            <button onClick={() => { useAppStore.getState().clearTasks(); setOpen(false); }} className="text-[10px] text-red-400">清空</button>
          </div>
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 py-1 border-b border-[var(--app-border-light)] last:border-0 text-xs" title={t.error || t.prompt}>
              {t.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-[var(--app-primary)]" />}
              {t.status === 'success' && <CheckCircle className="w-3 h-3 text-green-500" />}
              {t.status === 'failed' && <AlertCircle className="w-3 h-3 text-red-500" />}
              {t.status === 'cancelled' && <XCircle className="w-3 h-3 text-gray-400" />}
              {t.status === 'queued' && <Clock className="w-3 h-3 text-gray-400" />}
              <span className={`flex-1 truncate ${t.status === 'failed' ? 'text-red-500' : 'text-[var(--app-text-secondary)]'}`}>{t.status === 'failed' && t.error ? t.error : `${t.prompt.slice(0, 30)}...`}</span>
              {t.status === 'success' && t.videoUrl && <a href={t.videoUrl} download className="text-[var(--app-primary)] text-[10px]">下载</a>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function uploadToOss(imageData: string, store: ReturnType<typeof useAppStore.getState>): Promise<string> {
  try {
    const signRes = await fetch('/api/oss/sign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey: store.ossAccessKey, accessSecret: store.ossAccessSecret, bucket: store.ossBucket, region: store.ossRegion, endpoint: store.ossEndpoint, customDomain: store.ossCustomDomain, filename: 'ref.jpg' }),
    });
    if (!signRes.ok) return imageData;
    const { host, key, policy, signature, accessId } = await signRes.json();
    const imgRes = await fetch(imageData);
    if (!imgRes.ok) return imageData;
    const blob = await imgRes.blob();
    const fd = new FormData();
    fd.append('key', key);
    fd.append('policy', policy);
    fd.append('OSSAccessKeyId', accessId);
    fd.append('signature', signature);
    fd.append('success_action_status', '200');
    fd.append('file', blob, 'ref.jpg');
    const upRes = await fetch(host, { method: 'POST', body: fd });
    if (upRes.ok) return host + '/' + key;
  } catch { /* OSS 失败回退到原始 URL */ }
  return imageData;
}

const DEFAULT_KEYFRAME_COUNT = 4;
const MIN_KEYFRAME_COUNT = 2;
const MAX_KEYFRAME_COUNT = 8;

function clampKeyframeCount(value: number) {
  return Math.max(MIN_KEYFRAME_COUNT, Math.min(MAX_KEYFRAME_COUNT, Math.round(value || DEFAULT_KEYFRAME_COUNT)));
}

function formatTimeSec(timeSec: number) {
  const rounded = Math.round(timeSec * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function timeSlug(timeSec: number) {
  return formatTimeSec(timeSec).replace('.', 'p');
}

function defaultKeyframeTimes(duration: number, count: number) {
  const safeDuration = Math.max(1, duration || 1);
  const safeCount = clampKeyframeCount(count);
  if (safeCount === 1) return [0];
  return Array.from({ length: safeCount }, (_, index) => Math.round((index * safeDuration / (safeCount - 1)) * 10) / 10);
}

function makeKeyframe(index: number, prompt: string, imageUrl = '', timeSec = index): ShotKeyframe {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : 'kf' + Date.now() + '_' + index,
    index,
    timeSec,
    prompt: `${prompt}；第 ${formatTimeSec(timeSec)} 秒关键帧`,
    imageUrl,
  };
}

function keyframeCountOf(shot: Shot) {
  return clampKeyframeCount(shot.keyframes?.length || DEFAULT_KEYFRAME_COUNT);
}

function ensureKeyframes(shot: Shot, count = keyframeCountOf(shot)): ShotKeyframe[] {
  const safeCount = clampKeyframeCount(count);
  const times = defaultKeyframeTimes(shot.duration, safeCount);
  const existing = [...(shot.keyframes || [])].sort((a, b) => a.index - b.index);
  return Array.from({ length: safeCount }, (_, index) => {
    const current = existing[index];
    return current
      ? { ...current, index, timeSec: typeof current.timeSec === 'number' ? current.timeSec : times[index] }
      : makeKeyframe(index, shot.prompt, '', times[index]);
  });
}

function redistributeKeyframes(shot: Shot, count: number): ShotKeyframe[] {
  const safeCount = clampKeyframeCount(count);
  const times = defaultKeyframeTimes(shot.duration, safeCount);
  const existing = ensureKeyframes(shot, safeCount);
  return existing.map((keyframe, index) => ({
    ...keyframe,
    index,
    timeSec: times[index],
    prompt: keyframe.prompt || `${shot.prompt}；第 ${formatTimeSec(times[index])} 秒关键帧`,
  }));
}

function gridForKeyframeCount(count: number) {
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  return { columns, rows };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片无法读取，可能是远程图片未开放跨域访问'));
    image.src = src;
  });
}

async function splitKeyframeSheetImage(imageUrl: string, prompt: string, duration: number, count: number): Promise<ShotKeyframe[]> {
  const image = await loadImageElement(imageUrl);
  const safeCount = clampKeyframeCount(count);
  const { columns, rows } = gridForKeyframeCount(safeCount);
  const frameWidth = Math.floor(image.naturalWidth / columns);
  const frameHeight = Math.floor(image.naturalHeight / rows);
  const times = defaultKeyframeTimes(duration, safeCount);
  return Array.from({ length: safeCount }, (_, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器不支持 Canvas 切割');
    const sx = (index % columns) * frameWidth;
    const sy = Math.floor(index / columns) * frameHeight;
    ctx.drawImage(image, sx, sy, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
    return makeKeyframe(index, prompt, canvas.toDataURL('image/jpeg', 0.92), times[index]);
  });
}

function padShotNumber(value: number) {
  return String(value).padStart(3, '0');
}

function safeFilename(value: string) {
  return (value || 'untitled').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'untitled';
}

function fileExtFromUrl(url: string) {
  if (url.startsWith('data:image/png')) return 'png';
  if (url.startsWith('data:image/webp')) return 'webp';
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'jpg';
  try {
    const ext = new URL(url).pathname.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    return ext?.slice(0, 5) || 'jpg';
  } catch {
    return 'jpg';
  }
}

function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function buildDoubaoShotPackage(shot: Shot, scriptContent: string) {
  const shotNo = shot.order + 1;
  const shotName = `shot-${padShotNumber(shotNo)}`;
  const projectTitle = (scriptContent.split('\n').find((line) => line.trim()) || 'video-studio-project').trim().slice(0, 40);
  const keyframePlan = ensureKeyframes(shot);
  const useReferences = shot.generationMode !== 'text';
  const useSheet = shot.generationMode === 'sheet';
  const keyframes = useReferences
    ? keyframePlan
      .filter((keyframe) => keyframe.imageUrl)
      .map((keyframe) => ({
        id: keyframe.id,
        index: keyframe.index,
        timeSec: keyframe.timeSec,
        prompt: keyframe.prompt,
        url: keyframe.imageUrl,
        filename: `${shotName}-kf-${timeSlug(keyframe.timeSec)}.${fileExtFromUrl(keyframe.imageUrl)}`,
      }))
    : [];
  const sheet = useSheet && shot.imageUrl ? {
    label: '关键帧组图',
    url: shot.imageUrl,
    filename: `${shotName}-sheet.${fileExtFromUrl(shot.imageUrl)}`,
  } : undefined;

  return {
    type: 'doubao-shot-package',
    version: 1,
    exportedAt: new Date().toISOString(),
    projectTitle,
    scriptContent,
    shotId: shot.id,
    order: shotNo,
    duration: shot.duration,
    style: shot.style,
    resolution: shot.resolution,
    frameRate: shot.frameRate,
    generationMode: shot.generationMode,
    generationModeLabel: shotModeLabel(shot.generationMode),
    shotType: shot.shotType,
    cameraMove: shot.cameraMove,
    lighting: shot.lighting,
    colorTone: shot.colorTone,
    subject: shot.subject,
    scene: shot.scene,
    notes: shot.notes,
    prompt: composeVideoPrompt(shot),
    basePrompt: composeShotPrompt(shot),
    keyframeCount: keyframePlan.length,
    keyframeTimes: keyframePlan.map((keyframe) => keyframe.timeSec),
    keyframePlan: keyframePlan.map((keyframe) => ({
      id: keyframe.id,
      index: keyframe.index,
      timeSec: keyframe.timeSec,
      prompt: keyframe.prompt,
    })),
    sheet,
    keyframes,
    uploadOrder: keyframes.map((keyframe) => keyframe.filename),
  };
}

function buildDoubaoShotText(pkg: ReturnType<typeof buildDoubaoShotPackage>) {
  const isTextMode = pkg.generationMode === 'text';
  const isSheetMode = pkg.generationMode === 'sheet';
  const sheetText = pkg.sheet
    ? `关键帧组图：${pkg.sheet.url}\n文件名：${pkg.sheet.filename}`
    : '关键帧组图：未生成';
  const keyframePlanText = pkg.keyframePlan.map((keyframe, index) => `${index + 1}. ${formatTimeSec(keyframe.timeSec)}s：${keyframe.prompt || '按镜头提示词生成该时间点画面'}`).join('\n');
  const keyframeText = pkg.keyframes.length > 0
    ? pkg.keyframes.map((keyframe) => `第 ${formatTimeSec(keyframe.timeSec)} 秒：${keyframe.url}\n文件名：${keyframe.filename}\n说明：${keyframe.prompt || '按该时间点关键帧画面保持主体、构图和动作状态'}`).join('\n\n')
    : '未上传关键帧参考图；可直接按镜头提示词生成，或按上方时间点补充参考图。';
  const uploadOrderText = pkg.uploadOrder.length > 0
    ? pkg.uploadOrder.map((filename, index) => `${index + 1}. ${filename}`).join('\n')
    : '无可上传图片。';
  const keyframeMeta = isTextMode ? '' : `\n关键帧数量：${pkg.keyframeCount}\n关键帧时间点：${pkg.keyframeTimes.map(formatTimeSec).join('s / ')}s`;
  const sheetSection = isSheetMode ? `\n\n【关键帧组图】\n${sheetText}` : '';
  const referenceSection = isTextMode ? '' : `${sheetSection}\n\n【关键帧时间点】\n${keyframePlanText}\n\n【关键帧参考图】\n${keyframeText}\n\n【上传顺序】\n${uploadOrderText}`;
  const requirement = isTextMode
    ? `请根据镜头提示词生成连续 ${pkg.duration} 秒视频。参考图不是必需项，保持同一人物、服装、场景、光线、色调和构图连续。不要出现文字、水印、变脸、肢体畸变、画面跳变。`
    : `请生成连续 ${pkg.duration} 秒视频。参考图为可选项；如已上传关键帧参考图，请严格按对应时间点过渡；未上传时，请按镜头提示词和关键帧时间点生成画面变化。保持同一人物、服装、场景、光线、色调和构图连续。不要出现文字、水印、变脸、肢体畸变、画面跳变。`;

  return `【${pkg.projectTitle}】\n【镜头 ${pkg.order}】\n创建方式：${pkg.generationModeLabel}\n时长：${pkg.duration} 秒${keyframeMeta}\n画幅：16:9\n风格：${pkg.style || '默认'}\n分辨率：${pkg.resolution || '默认'}\n帧率：${pkg.frameRate || '默认'}\n景别：${pkg.shotType || '未设置'}\n运镜：${pkg.cameraMove || '未设置'}\n光线：${pkg.lighting || '未设置'}\n色调：${pkg.colorTone || '未设置'}\n主体：${pkg.subject || '未设置'}\n场景：${pkg.scene || '未设置'}\n备注：${pkg.notes || '无'}\n\n【镜头提示词】\n${pkg.basePrompt}\n\n【豆包视频提示词】\n${pkg.prompt}${referenceSection}\n\n【生成要求】\n${requirement}`;
}


function ProductionPipeline() {
  const stage = useAppStore((s) => s.productionStage);
  const setStage = useAppStore((s) => s.setProductionStage);
  const scriptContent = useAppStore((s) => s.scriptContent);
  const shots = useAppStore((s) => s.shots);
  const bible = useAppStore((s) => s.projectBible);
  const updateBible = useAppStore((s) => s.updateProjectBible);
  const activeStage = PRODUCTION_STAGES.find((item) => item.key === stage) || PRODUCTION_STAGES[0];
  const readyCount = shots.filter((shot) => shot.status === 'ready').length;
  const reviewCount = shots.filter((shot) => shot.status === 'review').length;
  const repairCount = shots.filter((shot) => shot.status === 'needs_repair' || shot.status === 'repairing').length;
  const lockedCount = shots.filter((shot) => shot.status === 'endframe_locked' || shot.status === 'archived').length;
  const promptedCount = shots.filter((shot) => shot.prompt.trim()).length;
  const withDirectorCount = shots.filter((shot) => shot.narrativeFunction || shot.directorIntent || shot.visualFocus).length;
  const withSpaceCount = shots.filter((shot) => shot.spatialLock).length;

  const stageEditor = (() => {
    if (stage === 'diagnosis') return { label: '剧本诊断输入', value: bible.diagnosisNotes, onChange: (value: string) => updateBible({ diagnosisNotes: value }), placeholder: '记录冲突、情绪转折、容易翻车段落、建议拆短镜头...' };
    if (stage === 'art') return { label: '美术圣经输入', value: [bible.characters, bible.scenes, bible.props, bible.styleRules].filter(Boolean).join('\n'), onChange: (value: string) => updateBible({ characters: value, scenes: value, props: value, styleRules: value }), placeholder: '人物外貌/服装、场景材质/光源、道具、色彩和画面质感...' };
    if (stage === 'space') return { label: '空间锁定输入', value: bible.spatialRules, onChange: (value: string) => updateBible({ spatialRules: value }), placeholder: '左中右站位、前中后景、视线关系、摄影机位置、光源方向、轴线规则...' };
    if (stage === 'prompt') return { label: 'Seedance 规则输入', value: bible.seedanceRules, onChange: (value: string) => updateBible({ seedanceRules: value }), placeholder: '首帧、时间线、运镜、结尾帧继承、10 秒段落规则...' };
    if (stage === 'repair') return { label: '局部修复规则', value: bible.negativeRules, onChange: (value: string) => updateBible({ negativeRules: value }), placeholder: '只改失败维度；保留成功的人物、服装、场景、光线、色调和构图...' };
    if (stage === 'post' || stage === 'publish') return { label: '后期发布输入', value: bible.postNotes, onChange: (value: string) => updateBible({ postNotes: value }), placeholder: '剪辑点、转场、字幕、环境声、拟音、音乐、发布规格、复盘备注...' };
    return { label: '本阶段输入位置', value: '', onChange: (_value: string) => undefined, placeholder: stage === 'creative' ? '在下方剧本区输入创意/剧本/参考素材。' : '在每张分镜卡片中补充本阶段字段。' };
  })();

  const stageOutput = (() => {
    if (stage === 'creative') return `剧本 ${scriptContent.trim().length} 字，镜头 ${shots.length} 个`;
    if (stage === 'diagnosis') return bible.diagnosisNotes ? '已有诊断备注，可进入导演拆解' : '尚未记录诊断输出';
    if (stage === 'director') return `${withDirectorCount}/${shots.length} 个镜头已补导演字段`;
    if (stage === 'art') return bible.characters || bible.scenes ? '已有项目级人物/场景规则' : '尚未填写美术圣经';
    if (stage === 'space') return `${withSpaceCount}/${shots.length} 个镜头已补空间锁定`;
    if (stage === 'storyboard') return `${readyCount} 个镜头待生成，${promptedCount} 个有提示词`;
    if (stage === 'prompt') return `${promptedCount}/${shots.length} 个镜头可导出 Seedance 提示词`;
    if (stage === 'review') return `${reviewCount} 个镜头待验收`;
    if (stage === 'repair') return `${repairCount} 个镜头需修复`;
    if (stage === 'endframe') return `${lockedCount}/${shots.length} 个镜头已锁定结尾帧`;
    if (stage === 'post') return bible.postNotes ? '已有剪辑声音备注' : '尚未填写后期备注';
    return `${lockedCount} 个镜头可入库复盘`;
  })();

  const stageAction = (() => {
    if (stage === 'creative') return '填写底部剧本区，然后生成剧本或拆解分镜。';
    if (stage === 'diagnosis') return '把风险写进诊断输入，避免直接生成高风险段落。';
    if (stage === 'director') return '在分镜卡片补叙事功能、视觉焦点、动作起止。';
    if (stage === 'art') return '在左侧生产规则沉淀人物、场景、道具和风格。';
    if (stage === 'space') return '在分镜卡片补空间锁定，明确站位、视线和光源。';
    if (stage === 'storyboard') return '补齐关键帧、景别、运镜、光线和色调。';
    if (stage === 'prompt') return '复制或导出镜头包，检查禁用项和衔接要求。';
    if (stage === 'review') return '播放生成结果，标记通过或失败维度。';
    if (stage === 'repair') return '选择失败维度，生成局部修复提示词。';
    if (stage === 'endframe') return '锁定结尾帧，写入下一镜头继承规则。';
    if (stage === 'post') return '整理剪辑顺序、字幕、声音和转场备注。';
    return '保存项目、导出发布包，并记录复盘信息。';
  })();

  return (
    <div className="border-b border-[var(--app-border)] bg-[var(--app-bg-alt)] px-3 py-2">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {PRODUCTION_STAGES.map((item) => {
          const active = item.key === stage;
          return (
            <button key={item.key} onClick={() => setStage(item.key)} className={`flex h-10 min-w-[92px] items-center gap-2 rounded-md border px-2 text-left transition-colors ${active ? 'border-[var(--app-primary)] bg-[var(--app-primary-light)] text-[var(--app-primary)]' : 'border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text-secondary)] hover:border-[var(--app-primary)]'}`}>
              <span className="text-[10px] font-bold">{item.no}</span>
              <span className="text-[11px] font-medium leading-4">{item.short}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--app-text-secondary)]">
        <span>生产队列：{shots.length} 镜头</span>
        <span className="text-amber-500">待验收 {reviewCount}</span>
        <span className="text-red-500">需修复 {repairCount}</span>
        <span className="text-emerald-500">已锁定结尾帧 {lockedCount}</span>
      </div>
    </div>
  );
}

function parseAssetText(text: string, existingNames: Set<string>): AssetItem[] {
  const items: AssetItem[] = [];
  const lines = text.split(/[\n；;]/).filter(Boolean);
  for (const line of lines) {
    const colonIdx = line.indexOf('：') > -1 ? line.indexOf('：') : line.indexOf(':');
    if (colonIdx > 0) {
      const name = line.slice(0, colonIdx).trim();
      const desc = line.slice(colonIdx + 1).trim();
      if (name && !existingNames.has(name)) {
        items.push({ id: crypto.randomUUID(), name, description: desc, imageUrl: '' });
      }
    } else if (line.trim() && line.trim().length <= 20 && !existingNames.has(line.trim())) {
      items.push({ id: crypto.randomUUID(), name: line.trim(), description: '', imageUrl: '' });
    }
  }
  return items;
}

function AssetColumn({ title, assets, type }: { title: string; assets: AssetItem[]; type: 'characterAssets' | 'sceneAssets' | 'propAssets' }) {
  const store = useAppStore();
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const addNew = () => {
    if (!newName.trim()) return;
    store.addAsset(type, { id: crypto.randomUUID(), name: newName.trim(), description: newDesc.trim(), imageUrl: '' });
    setNewName(''); setNewDesc('');
  };

  const handleGenSingle = async (asset: AssetItem) => {
    if (!store.imageApiKey) return;
    try {
      const prompt = `${title}参考图：${asset.name}，${asset.description || asset.name}。正面，纯色背景，无文字水印，${store.selectedStyle}风格。`;
      const url = await generateImage(prompt, store.imageApiBaseUrl, store.imageApiKey, store.selectedImageModel, store.imageSize, store.selectedStyle);
      if (!url) throw new Error('未返回图片');
      store.updateAsset(type, asset.id, { imageUrl: url });
      uploadToOss(url, store).then((finalUrl) => {
        if (finalUrl !== url) store.updateAsset(type, asset.id, { imageUrl: finalUrl });
      }).catch(() => {});
      store.addToast({ kind: 'success', message: `${asset.name} 已生成` });
    } catch (e) { store.addToast({ kind: 'error', message: '生成失败' }); }
  };

  const handleUpload = async (file: File, assetId: string) => {
    try {
      const b64 = await fileToBase64(file);
      const url = await uploadToOss(b64, store);
      store.updateAsset(type, assetId, { imageUrl: url });
    } catch { store.addToast({ kind: 'error', message: '上传失败' }); }
  };

  return (
    <div className="rounded border border-[var(--app-border)] bg-[var(--app-bg-alt)] p-1.5 space-y-1.5">
      <span className="text-[11px] font-bold text-[var(--app-text)]">{title}</span>
      <div className="flex items-center gap-1 text-[9px] font-medium text-[var(--app-text-muted)] px-1">
        <span className="w-16 shrink-0">名称</span>
        <span className="flex-1">描述</span>
        <span className="w-20 shrink-0 text-right">参考图</span>
      </div>
      <div className="space-y-0.5">
        {(assets || []).map((asset) => (
          <div key={asset.id} className="flex items-center gap-1 rounded border border-[var(--app-border)] bg-[var(--app-bg)] px-1 py-0.5 group">
            <input value={asset.name} onChange={(e) => store.updateAsset(type, asset.id, { name: e.target.value })} className="w-16 shrink-0 text-[9px] font-medium bg-transparent outline-none text-[var(--app-text)]" placeholder="名称" />
            <input value={asset.description} onChange={(e) => store.updateAsset(type, asset.id, { description: e.target.value })} className="flex-1 min-w-0 text-[9px] bg-transparent outline-none text-[var(--app-text-muted)]" placeholder="描述" />
            <div className="flex items-center gap-0.5 w-20 shrink-0 justify-end">
              {asset.imageUrl ? (
                <img src={asset.imageUrl} alt="" className="w-6 h-6 rounded border border-[var(--app-border)] object-cover cursor-zoom-in hover:ring-1 hover:ring-[var(--app-primary)]" onClick={() => setZoomImage(asset.imageUrl)} />
              ) : (
                <button onClick={() => handleGenSingle(asset)} className="w-6 h-6 rounded border border-dashed border-[var(--app-border)] flex items-center justify-center text-[var(--app-primary)] text-[8px] hover:bg-[var(--app-primary-light)] shrink-0">AI</button>
              )}
              <label className="w-6 h-6 rounded border border-dashed border-[var(--app-border)] flex items-center justify-center cursor-pointer hover:border-[var(--app-primary)] text-[var(--app-text-muted)] text-[8px] shrink-0">+
                <input type="file" accept="image/*" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) handleUpload(f, asset.id); ev.target.value = ''; }} />
              </label>
              <button onClick={() => store.removeAsset(type, asset.id)} className="w-5 h-5 rounded flex items-center justify-center text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] shrink-0">&times;</button>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-1 rounded border border-dashed border-[var(--app-border)] bg-[var(--app-bg)] px-1 py-0.5">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="添加" className="w-16 shrink-0 text-[9px] bg-transparent outline-none text-[var(--app-text-muted)]" onKeyDown={(e) => { if (e.key === 'Enter') addNew(); }} />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="描述" className="flex-1 min-w-0 text-[9px] bg-transparent outline-none text-[var(--app-text-muted)]" onKeyDown={(e) => { if (e.key === 'Enter') addNew(); }} />
          <button onClick={addNew} disabled={!newName.trim()} className="text-[9px] text-[var(--app-primary)] hover:underline disabled:opacity-30 shrink-0">添加</button>
        </div>
      </div>
      {zoomImage && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setZoomImage(null)}>
          <button onClick={() => setZoomImage(null)} className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"><X className="w-5 h-5" /></button>
          <img src={zoomImage} alt="预览" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function StageWorkspace() {
  const store = useAppStore();
  const stage = useAppStore((s) => s.productionStage);
  const setStage = useAppStore((s) => s.setProductionStage);
  const scriptContent = useAppStore((s) => s.scriptContent);
  const shots = useAppStore((s) => s.shots);
  const bible = useAppStore((s) => s.projectBible);
  const updateBible = useAppStore((s) => s.updateProjectBible);
  const activeStage = PRODUCTION_STAGES.find((item) => item.key === stage) || PRODUCTION_STAGES[0];
  const reviewCount = shots.filter((shot) => shot.status === 'review').length;
  const repairCount = shots.filter((shot) => shot.status === 'needs_repair' || shot.status === 'repairing').length;
  const lockedCount = shots.filter((shot) => shot.status === 'endframe_locked' || shot.status === 'archived').length;
  const promptedCount = shots.filter((shot) => shot.prompt.trim()).length;
  const withDirectorCount = shots.filter((shot) => shot.narrativeFunction || shot.directorIntent || shot.visualFocus).length;
  const withSpaceCount = shots.filter((shot) => shot.spatialLock).length;
  const promptShot = shots.find((shot) => shot.prompt.trim()) || shots[0];
  const promptPreview = promptShot ? composeVideoPrompt(promptShot) : '';
  const queueShots = stage === 'review'
    ? shots.filter((shot) => shot.status === 'review' || shot.videoUrl)
    : stage === 'repair'
      ? shots.filter((shot) => shot.status === 'needs_repair' || shot.status === 'repairing')
      : stage === 'endframe'
        ? shots.filter((shot) => shot.status === 'approved' || shot.status === 'endframe_locked' || shot.videoUrl)
        : [];

  const stageOutput = (() => {
    if (stage === 'creative') return `剧本 ${scriptContent.trim().length} 字，镜头 ${shots.length} 个`;
    if (stage === 'diagnosis') return bible.diagnosisNotes ? '已有诊断备注，可进入导演拆解' : '尚未记录诊断输出';
    if (stage === 'director') return `${withDirectorCount}/${shots.length} 个镜头已补导演字段`;
    if (stage === 'art') return bible.characters || bible.scenes ? '已有项目级人物/场景规则' : '尚未填写美术圣经';
    if (stage === 'space') return `${withSpaceCount}/${shots.length} 个镜头已补空间锁定`;
    if (stage === 'storyboard') return `${promptedCount}/${shots.length} 个镜头有提示词`;
    if (stage === 'prompt') return `${promptedCount}/${shots.length} 个镜头可导出 Seedance 提示词`;
    if (stage === 'review') return `${reviewCount} 个镜头待验收`;
    if (stage === 'repair') return `${repairCount} 个镜头需修复`;
    if (stage === 'endframe') return `${lockedCount}/${shots.length} 个镜头已锁定结尾帧`;
    if (stage === 'post') return bible.postNotes ? '已有剪辑声音备注' : '尚未填写后期备注';
    return `${lockedCount} 个镜头可入库复盘`;
  })();

  const stageAction = (() => {
    if (stage === 'creative') return '在这里输入创意、剧本或参考素材，然后生成剧本或拆解分镜。';
    if (stage === 'diagnosis') return '记录可生成性风险，避免把高风险段落直接送去抽卡。';
    if (stage === 'director') return '到下方镜头生产板，为每张卡补叙事功能、视觉焦点和动作起止。';
    if (stage === 'art') return '沉淀人物、场景、道具和风格规则，后续会进入镜头提示词。';
    if (stage === 'space') return '明确站位、视线、摄影机和光源，降低多人场景漂移。';
    if (stage === 'storyboard') return '补齐关键帧、景别、运镜、光线、色调和镜头时长。';
    if (stage === 'prompt') return '检查完整提示词、禁用项、时间线和镜头衔接要求。';
    if (stage === 'review') return '播放生成结果，标记通过或选择失败维度。';
    if (stage === 'repair') return '只针对失败维度生成修复词，不整段推翻。';
    if (stage === 'endframe') return '锁定每段结尾帧，并写入下一镜头继承规则。';
    if (stage === 'post') return '整理剪辑顺序、字幕、声音、转场和发布备注。';
    return '保存项目、导出发布包，并记录复盘信息。';
  })();

  const editable = (() => {
    if (stage === 'diagnosis') return { value: bible.diagnosisNotes, onChange: (value: string) => updateBible({ diagnosisNotes: value }), placeholder: '冲突、情绪转折、易翻车段落、建议拆短镜头...' };
    if (stage === 'art') return { value: [bible.characters, bible.scenes, bible.props, bible.styleRules].filter(Boolean).join('\n'), onChange: (value: string) => updateBible({ characters: value, scenes: value, props: value, styleRules: value }), placeholder: '人物外貌/服装、场景材质/光源、道具、色彩和画面质感...' };
    if (stage === 'space') return { value: bible.spatialRules, onChange: (value: string) => updateBible({ spatialRules: value }), placeholder: '左中右站位、前中后景、视线关系、摄影机位置、光源方向、轴线规则...' };
    if (stage === 'prompt') return { value: bible.seedanceRules, onChange: (value: string) => updateBible({ seedanceRules: value }), placeholder: '首帧、时间线、运镜、结尾帧继承、10 秒段落规则...' };
    if (stage === 'repair') return { value: bible.negativeRules, onChange: (value: string) => updateBible({ negativeRules: value }), placeholder: '只改失败维度；保留成功的人物、服装、场景、光线、色调和构图...' };
    if (stage === 'post' || stage === 'publish') return { value: bible.postNotes, onChange: (value: string) => updateBible({ postNotes: value }), placeholder: '剪辑点、转场、字幕、环境声、拟音、音乐、发布规格、复盘备注...' };
    return null;
  })();

  const copyPreview = async () => {
    if (!promptPreview) return;
    await navigator.clipboard.writeText(promptPreview);
    store.addToast({ kind: 'success', message: '当前镜头提示词已复制。' });
  };

  return (
    <section className="mb-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-card-bg)] p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">当前阶段工作台</div>
          <h2 className="mt-0.5 text-base font-bold text-[var(--app-text)]">{activeStage.no} {activeStage.label}</h2>
        </div>
        <div className="grid grid-cols-3 gap-1 text-center text-[10px] text-[var(--app-text-secondary)]">
          <span className="rounded bg-[var(--app-bg-alt)] px-2 py-1">提示词 {promptedCount}</span>
          <span className="rounded bg-[var(--app-bg-alt)] px-2 py-1">验收 {reviewCount}</span>
          <span className="rounded bg-[var(--app-bg-alt)] px-2 py-1">修复 {repairCount}</span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-md border border-[var(--app-border)] bg-[var(--app-bg-alt)] p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--app-text)]">输入与配置</span>
            <span className="text-[10px] text-[var(--app-text-secondary)]">{stage === 'creative' ? '剧本入口' : '阶段规则'}</span>
          </div>
          {stage === 'creative' ? <ScriptInput /> : stage === 'director' || stage === 'storyboard' ? (
            <div className="rounded border border-dashed border-[var(--app-border)] bg-[var(--app-bg)] p-3 text-xs leading-5 text-[var(--app-text-secondary)]">提示词预览和编辑已移至下方镜头卡片中。在每张卡的"07 提示词"区段操作。</div>
          ) : stage === 'prompt' ? (
            <textarea value={bible.seedanceRules} onChange={(e) => updateBible({ seedanceRules: e.target.value })} placeholder="首帧、时间线、运镜、结尾帧继承、10 秒段落规则..." className="h-24 w-full resize-none rounded border border-[var(--app-border)] bg-[var(--app-bg)] p-2 text-xs text-[var(--app-text)] outline-none placeholder:text-gray-400 focus:border-[var(--app-primary)]" />
          ) : stage === 'art' ? (
            <div className="space-y-3">
              <div className="text-[10px] text-[var(--app-text-secondary)] leading-relaxed">人物/场景/道具的参考图标准，作为全片视觉锚点注入每个镜头的 prompt。</div>
              <div className="grid grid-cols-3 gap-2">
                <AssetColumn title="人物库" assets={bible.characterAssets} type="characterAssets" />
                <AssetColumn title="场景库" assets={bible.sceneAssets} type="sceneAssets" />
                <AssetColumn title="道具库" assets={bible.propAssets} type="propAssets" />
              </div>
            </div>
          ) : editable ? (
            <textarea value={editable.value} onChange={(e) => editable.onChange(e.target.value)} placeholder={editable.placeholder} className="h-24 w-full resize-none rounded border border-[var(--app-border)] bg-[var(--app-bg)] p-2 text-xs text-[var(--app-text)] outline-none placeholder:text-gray-400 focus:border-[var(--app-primary)]" />
          ) : queueShots.length > 0 ? (
            <div className="grid gap-1">
              {queueShots.slice(0, 6).map((shot) => (
                <div key={shot.id} className="flex items-center justify-between gap-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1 text-xs">
                  <span className="min-w-0 truncate">镜头 {shot.order + 1} · {SHOT_STATUS_LABELS[shot.status]}</span>
                  <span className="shrink-0 text-[10px] text-[var(--app-text-secondary)]">{shot.failureDimensions?.length ? `${shot.failureDimensions.length} 项问题` : shot.endFrameUrl ? '已锁结尾' : '待处理'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded border border-dashed border-[var(--app-border)] bg-[var(--app-bg)] p-3 text-xs leading-5 text-[var(--app-text-secondary)]">本阶段的主要输入在下方镜头生产板中完成。按镜头逐张补字段，右侧输出会同步更新。</div>
          )}
        </div>

        <div className="grid gap-2">
          <div className="rounded-md border border-[var(--app-border)] bg-[var(--app-bg-alt)] p-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">阶段输出</div>
            <div className="text-sm font-semibold text-[var(--app-text)]">{stageOutput}</div>
          </div>
          <div className="rounded-md border border-[var(--app-border)] bg-[var(--app-bg-alt)] p-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">下一步动作</div>
            <div className="text-xs leading-5 text-[var(--app-text)]">{stageAction}</div>
        </div>
        </div>
      </div>
    </section>
  );
}
export function CreatorPanel() {
  const store = useAppStore();
  const [genAll, setGenAll] = useState(false);
  const cancelRef = useRef(false);

  const addNewShot = () => store.addShot(newShotBase(store.shots.length, store));

  const exportAllPrompts = () => {
    const text = store.shots.map((s, i) => `【镜头${i + 1}】${s.duration}秒\n${composeVideoPrompt(s)}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '分镜提示词.txt'; a.click(); URL.revokeObjectURL(a.href);
    store.addToast({ kind: 'success', message: '分镜提示词已导出。' });
  };

  const getTargetShots = (mode: 'all' | 'missing' | 'failed') => {
    const base = store.shots.filter((shot) => shot.prompt.trim());
    if (mode === 'missing') return base.filter((shot) => !shot.videoUrl);
    if (mode === 'failed') {
      const failedIds = new Set(store.taskQueue.filter((t) => t.status === 'failed').map((t) => t.shotId));
      return base.filter((shot) => failedIds.has(shot.id));
    }
    return base;
  };

  const handleGenerateVideos = async (mode: 'all' | 'missing' | 'failed') => {
    if (!store.videoApiKey || !store.videoApiBaseUrl || !store.selectedVideoModel) return;
    const targetShots = getTargetShots(mode);
    if (targetShots.length === 0) {
      store.addToast({ kind: 'info', message: mode === 'missing' ? '没有未完成的视频镜头。' : mode === 'failed' ? '没有可重试的失败镜头。' : '至少需要一个有提示词的镜头。' });
      return;
    }
    cancelRef.current = false;
    setGenAll(true);
    const completedTasks: { shotId: string; videoUrl: string }[] = [];
    try {
      for (const shot of targetShots) {
        const prompt = composeVideoPrompt(shot);
        const referenceImage = shot.generationMode === 'text' ? undefined : primaryReferenceImage(shot);
        const keyframeUrls = shot.generationMode === 'text' ? [] : referenceImageUrls(shot);
        const taskId = 't' + Date.now().toString(36) + Math.random().toString(36);
        const startedAt = Date.now();
        if (cancelRef.current) {
          store.addTask({ id: taskId, shotId: shot.id, status: 'cancelled', prompt, imageUrl: referenceImage, keyframeUrls, createdAt: startedAt, error: '已取消' });
          continue;
        }
        store.addTask({ id: taskId, shotId: shot.id, status: 'queued', prompt, imageUrl: referenceImage, keyframeUrls, createdAt: startedAt });
        store.updateShot(shot.id, { status: 'generating' });
        store.updateTask(taskId, { status: 'running' });
        try {
          const videoUrl = await generateVideo(prompt, referenceImage, shot.resolution, shot.duration, store.videoApiBaseUrl, store.videoApiKey, store.selectedVideoModel, store.videoSize);
          store.updateTask(taskId, { status: 'success', videoUrl, duration: Date.now() - startedAt });
          store.updateShot(shot.id, { videoUrl, status: 'review', reviewStatus: 'pending' });
          completedTasks.push({ shotId: shot.id, videoUrl });
        } catch (e) {
          store.updateTask(taskId, { status: 'failed', error: (e as Error).message, duration: Date.now() - startedAt });
          store.updateShot(shot.id, { status: 'needs_repair', reviewStatus: 'rejected', repairNotes: (e as Error).message });
        }
      }
      const latestShots = useAppStore.getState().shots.map((s) => ({ ...s }));
      if (completedTasks.length > 0) {
        store.addProjectRecord({ id: '', scriptContent: store.scriptContent, shots: latestShots, videoUrl: completedTasks[0].videoUrl, createdAt: Date.now() });
        store.addToast({ kind: 'success', message: `已生成 ${completedTasks.length}/${targetShots.length} 个视频，并保存到历史记录。` });
      } else if (cancelRef.current) {
        store.addToast({ kind: 'info', message: '批量生成已取消。' });
      } else {
        store.addToast({ kind: 'error', message: '视频生成全部失败，请查看任务队列中的失败原因。' });
      }
    } finally {
      setGenAll(false);
      cancelRef.current = false;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ProductionPipeline />
      <div className="flex-1 overflow-y-auto p-3 pb-0">
        <StageWorkspace />
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">镜头生产板</div>
            <div className="text-xs text-[var(--app-text-secondary)]">按当前阶段补齐每个镜头的画面、导演、空间、验收、修复和衔接信息。</div>
          </div>
        </div>
        {store.shots.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {store.shots.map((shot) => <ShotCard key={shot.id} shot={shot} />)}
            <button onClick={addNewShot} className="border-2 border-dashed border-[var(--app-border)] rounded-lg flex items-center justify-center text-gray-400 hover:border-[var(--app-primary)] hover:text-[var(--app-primary)] transition-colors min-h-[220px]">
              + 添加镜头
            </button>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-400">
            <div>输入剧本并拆解，或手动添加镜头</div>
            <Button variant="outline" size="sm" onClick={addNewShot}>+ 手动添加镜头</Button>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t-2 border-[var(--app-primary)] bg-[var(--app-bg)] p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--app-text-secondary)]">{store.shots.length > 0 ? `共 ${store.shots.length} 个镜头` : ''}</span>
            {store.shots.length > 0 && (
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-500" onClick={() => { store.setShots([]); store.setScriptContent(''); store.addToast({ kind: 'info', message: '当前创作内容已清空。' }); }}>
                <Trash2 className="w-3 h-3 mr-1" />清空
              </Button>
            )}
          </div>
          <div className="flex gap-1 flex-wrap justify-end">
            <TaskOverview />
            {store.shots.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={() => { store.addProjectRecord({ id: '', scriptContent: store.scriptContent, shots: store.shots.map((s) => ({ ...s })), createdAt: Date.now() }); store.addToast({ kind: 'success', message: '项目已保存到历史记录。' }); }}>保存项目</Button>
                <Button variant="outline" size="sm" onClick={exportAllPrompts}>导出全部</Button>
                <Button variant="outline" size="sm" onClick={() => handleGenerateVideos('missing')} disabled={genAll || !store.videoApiKey}>未完成</Button>
                <Button variant="outline" size="sm" onClick={() => handleGenerateVideos('failed')} disabled={genAll || !store.videoApiKey}>重试失败</Button>
                {genAll ? (
                  <Button variant="danger" size="sm" onClick={() => { cancelRef.current = true; store.addToast({ kind: 'info', message: '已请求取消，当前镜头结束后停止。' }); }}>
                    <XCircle className="w-3 h-3 mr-1" />取消
                  </Button>
                ) : (
                  <Button onClick={() => handleGenerateVideos('all')} disabled={!store.videoApiKey || store.shots.length === 0} size="sm" className="bg-[var(--app-primary)] hover:bg-[var(--app-primary-hover)]">
                    <Play className="w-3 h-3 mr-1" />立即生成
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShotCard({ shot }: { shot: Shot }) {
  const store = useAppStore();
  const currentStage = useAppStore((s) => s.productionStage);
  const [genImg, setGenImg] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(shot.prompt);
  const [frameUploadIndex, setFrameUploadIndex] = useState(0);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [suggestSheet, setSuggestSheet] = useState(false);
  const [sheetSuggestion, setSheetSuggestion] = useState('');
  const [genSheetSuggestion, setGenSheetSuggestion] = useState(false);
  const [suggestingKeyframeIndex, setSuggestingKeyframeIndex] = useState<number | null>(null);
  const [keyframeSuggestion, setKeyframeSuggestion] = useState('');
  const [genKeyframeSuggestion, setGenKeyframeSuggestion] = useState(false);
  const [checkingVideo, setCheckingVideo] = useState(false);
  const [aiReviewResult, setAiReviewResult] = useState('');
  const [capturedFrames, setCapturedFrames] = useState<{ timeSec: number; base64: string }[]>([]);
  const promptRef = useRef<ReturnType<typeof setTimeout>>();
  const imgInputRef = useRef<HTMLInputElement>(null);
  const frameInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const keyframeCount = keyframeCountOf(shot);
  const visibleKeyframes = ensureKeyframes(shot, keyframeCount);
  const filledKeyframes = visibleKeyframes.filter((keyframe) => keyframe.imageUrl).length;
  const timelineLabel = visibleKeyframes.map((keyframe) => `${formatTimeSec(keyframe.timeSec)}s`).join(' / ');
  const frameGridStyle = { gridTemplateColumns: `repeat(${Math.min(4, keyframeCount)}, minmax(0, 1fr))` };
  const generationMode = shot.generationMode || 'sheet';
  const showSheetTools = generationMode === 'sheet';
  const showKeyframeTools = generationMode !== 'text';
  const showVisualFields = ['creative', 'storyboard', 'prompt'].includes(currentStage);
  const showDirectorFields = ['director', 'storyboard'].includes(currentStage);
  const showSpaceFields = ['space', 'storyboard'].includes(currentStage);
  const showPromptFields = ['prompt', 'storyboard'].includes(currentStage);
  const showReviewFields = ['review', 'repair', 'endframe'].includes(currentStage);
  const showKeyframePanel = showKeyframeTools && ['storyboard', 'prompt', 'review', 'repair', 'endframe'].includes(currentStage);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([currentStage]));

  const currentStageIndex = PRODUCTION_STAGES.findIndex((s) => s.key === currentStage);
  const isStageReached = (key: string) => {
    const idx = PRODUCTION_STAGES.findIndex((s) => s.key === key);
    return idx >= 0 && idx <= currentStageIndex;
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    setExpandedSections(new Set([currentStage]));
  }, [currentStage]);

  const isExpanded = (key: string) => expandedSections.has(key);

  const renderSection = (stageKey: string, no: string, label: string, summary: string, content: React.ReactNode, accent?: boolean) => {
    if (!isStageReached(stageKey)) return null;
    if (currentStage === stageKey) {
      return (
        <div key={stageKey} className={accent ? 'bg-amber-50/20 dark:bg-amber-500/5' : 'bg-[var(--app-primary-light)]/20'}>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className={`text-[10px] font-bold w-5 shrink-0 ${accent ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--app-primary)]'}`}>{no}</span>
            <span className="text-[10px] font-medium text-[var(--app-text)]">{label}</span>
          </div>
          {content}
        </div>
      );
    }
    return (
      <div key={stageKey} className={isExpanded(stageKey) ? (accent ? 'bg-amber-50/20 dark:bg-amber-500/5' : 'bg-[var(--app-primary-light)]/20') : ''}>
        <button onClick={() => toggleSection(stageKey)} className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-[var(--app-hover)]/30 transition-colors">
          <span className={`text-[10px] font-bold w-5 shrink-0 ${accent ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--app-text-muted)]'}`}>{no}</span>
          <span className="text-[10px] font-medium text-[var(--app-text)] flex-1">{label}</span>
          <span className="text-[9px] text-[var(--app-text-muted)] truncate max-w-[120px]">{summary}</span>
          <ChevronDown className={`w-3 h-3 shrink-0 text-[var(--app-text-muted)] transition-transform ${isExpanded(stageKey) ? 'rotate-180' : ''}`} />
        </button>
        {isExpanded(stageKey) && content}
      </div>
    );
  };

  useEffect(() => { setLocalPrompt(shot.prompt); }, [shot.prompt]);

  const handlePromptChange = (val: string) => {
    setLocalPrompt(val);
    clearTimeout(promptRef.current);
    promptRef.current = setTimeout(() => store.updateShot(shot.id, { prompt: val }), 300);
  };

  const applyFourGridImage = async (sourceUrl: string, successMessage: string) => {
    try {
      const splitFrames = await splitKeyframeSheetImage(sourceUrl, composeShotPrompt(shot), shot.duration, keyframeCount);
      const [finalSheet, ...frameUrls] = await Promise.all([
        uploadToOss(sourceUrl, store),
        ...splitFrames.map((keyframe) => uploadToOss(keyframe.imageUrl, store)),
      ]);
      const keyframes = splitFrames.map((keyframe, index) => ({ ...keyframe, imageUrl: frameUrls[index] }));
      store.updateShot(shot.id, { imageUrl: finalSheet, keyframes });
      store.addToast({ kind: 'success', message: successMessage });
    } catch (err) {
      const finalSheet = await uploadToOss(sourceUrl, store);
      store.updateShot(shot.id, { imageUrl: finalSheet });
      store.addToast({ kind: 'error', message: '关键帧组图已保存，但自动切割失败：' + (err as Error).message });
    }
  };

  const handleGenImage = async () => {
    const prompt = composeShotPrompt(shot);
    if (!store.imageApiKey || !prompt) return;
    setGenImg(true);
    try {
      const url = await generateKeyframeSheet(prompt, shot.duration, visibleKeyframes.map((keyframe) => keyframe.timeSec), store.imageApiBaseUrl, store.imageApiKey, store.selectedImageModel, store.imageSize, store.selectedStyle);
      await applyFourGridImage(url, `镜头 ${shot.order + 1} 的关键帧组图已生成并切割。`);
    } catch (e) {
      store.addToast({ kind: 'error', message: '关键帧组图生成失败：' + (e as Error).message });
    } finally {
      setGenImg(false);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await fileToBase64(file);
      await applyFourGridImage(b64, `镜头 ${shot.order + 1} 的关键帧组图已上传并切割。`);
    } catch (e) {
      store.addToast({ kind: 'error', message: '关键帧组图上传失败：' + (e as Error).message });
    } finally {
      e.target.value = '';
    }
  };

  const handleUploadKeyframe = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await fileToBase64(file);
      const finalUrl = await uploadToOss(b64, store);
      const keyframes = ensureKeyframes(shot, keyframeCount).map((keyframe, index) => (
        index === frameUploadIndex ? { ...keyframe, imageUrl: finalUrl } : keyframe
      ));
      store.updateShot(shot.id, { keyframes });
      const timeSec = keyframes[frameUploadIndex]?.timeSec ?? frameUploadIndex;
      store.addToast({ kind: 'success', message: `第 ${formatTimeSec(timeSec)} 秒关键帧已更新。` });
    } catch (e) {
      store.addToast({ kind: 'error', message: '关键帧上传失败：' + (e as Error).message });
    } finally {
      e.target.value = '';
    }
  };

  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      store.addToast({ kind: 'info', message: '视频上传中...' });
      const b64 = await fileToBase64(file);
      const finalUrl = await uploadToOss(b64, store);
      store.updateShot(shot.id, { videoUrl: finalUrl, status: 'review' });
      store.addToast({ kind: 'success', message: `镜头 ${shot.order + 1} 视频已上传。` });
    } catch (e) {
      store.addToast({ kind: 'error', message: '视频上传失败：' + (e as Error).message });
    } finally {
      e.target.value = '';
    }
  };

  const captureFrame = (video: HTMLVideoElement, timeSec: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      video.currentTime = timeSec;
      video.addEventListener('seeked', function handler() {
        video.removeEventListener('seeked', handler);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas 不可用'));
          ctx.drawImage(video, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } catch (e) { reject(e); }
      }, { once: true });
      video.addEventListener('error', () => reject(new Error('视频 seek 失败')), { once: true });
    });
  };

  const handleCheckVideo = async () => {
    if (!shot.videoUrl || !store.textApiKey) return;
    setCheckingVideo(true);
    setAiReviewResult('');
    setCapturedFrames([]);
    try {
      const video = document.createElement('video');
      video.src = shot.videoUrl;
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      await new Promise<void>((resolve, reject) => {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        video.addEventListener('error', () => reject(new Error('视频加载失败')), { once: true });
        video.load();
      });

      const duration = video.duration;
      const MAX_FRAMES = 10;
      const interval = Math.max(0.5, duration / MAX_FRAMES);
      const sampleCount = Math.min(MAX_FRAMES, Math.ceil(duration / interval));
      const sampleTimes: number[] = [];
      for (let i = 0; i < sampleCount; i++) {
        sampleTimes.push(Math.round((i * interval + interval / 2) * 10) / 10);
      }

      const frames: { timeSec: number; base64: string }[] = [];
      for (const timeSec of sampleTimes) {
        const b64 = await captureFrame(video, timeSec);
        frames.push({ timeSec, base64: b64 });
      }
      setCapturedFrames(frames);
      video.pause();
      video.removeAttribute('src');
      video.load();

      const prompt = `你是视频验收质检员。以下是镜头"${shot.prompt?.slice(0, 100)}"的 ${duration} 秒生成视频的 ${sampleTimes.length} 张均匀截图（采样间隔 ${interval.toFixed(1)}秒）。

请逐帧检查：
1. 角色外观、服装、场景是否与提示词一致
2. 是否出现变脸、肢体畸变、闪烁
3. 光线、色调、景别、运镜是否连贯
4. 帧间动作是否流畅无跳变

按以下格式输出：
${sampleTimes.map(t => `【${t}秒】✅通过 / ⚠️问题：...`).join('\n')}
【总体结论】通过/需修复：...`;

      const content: any[] = [{ type: 'text', text: prompt }];
      for (const f of frames) {
        content.push({ type: 'image_url', image_url: { url: f.base64, detail: 'low' } });
      }
      if (shot.imageUrl) {
        content.push({ type: 'text', text: '原始参考组图：' });
        content.push({ type: 'image_url', image_url: { url: shot.imageUrl, detail: 'low' } });
      }

      const baseUrl = store.textApiBaseUrl;
      const apiKey = store.textApiKey;
      const model = store.selectedTextModel || 'gpt-4-vision-preview';
      const headers: Record<string, string> = {
        'X-Api-Base-Url': baseUrl,
        'X-Api-Key': apiKey,
        'X-Api-Endpoint': '/v1/chat/completions',
        'Content-Type': 'application/json',
      };
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages: [{ role: 'user', content }], max_tokens: 1000 }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(err.slice(0, 200) || `API ${res.status}`);
      }
      const data = await res.json();
      setAiReviewResult(data.choices?.[0]?.message?.content || '未获取到验收结果');
      store.addToast({ kind: 'success', message: 'AI 验收完成，结果见下方。' });
    } catch (e) {
      store.addToast({ kind: 'error', message: 'AI 验收失败：' + (e as Error).message });
    }
    setCheckingVideo(false);
  };

  const setKeyframeCount = (count: number) => {
    store.updateShot(shot.id, { keyframes: redistributeKeyframes(shot, count) });
  };

  const updateDuration = (duration: number) => {
    const safeDuration = Math.max(1, duration || 1);
    const keyframes = ensureKeyframes(shot, keyframeCount).map((keyframe) => ({
      ...keyframe,
      timeSec: Math.min(keyframe.timeSec, safeDuration),
    }));
    store.updateShot(shot.id, { duration: safeDuration, keyframes });
  };

  const updateKeyframeTime = (index: number, value: number) => {
    const safeTime = Math.max(0, Math.min(shot.duration, Number.isFinite(value) ? value : 0));
    const keyframes = ensureKeyframes(shot, keyframeCount).map((keyframe, frameIndex) => (
      frameIndex === index ? { ...keyframe, timeSec: Math.round(safeTime * 10) / 10 } : keyframe
    ));
    store.updateShot(shot.id, { keyframes });
  };

  const clearKeyframe = (index: number) => {
    const keyframes = ensureKeyframes(shot, keyframeCount).map((keyframe, frameIndex) => (
      frameIndex === index ? { ...keyframe, imageUrl: '', videoUrl: undefined } : keyframe
    ));
    store.updateShot(shot.id, { keyframes });
  };

  const handleSuggestSheet = async () => {
    if (!sheetSuggestion.trim() || !store.imageApiKey) return;
    setGenSheetSuggestion(true);
    try {
      const basePrompt = composeShotPrompt(shot);
      const prompt = `${basePrompt}。修改要求：${sheetSuggestion}。必须保持与参考图相同的角色外观、服装、场景、构图和镜头语言，只微调指定细节。`;
      const url = await generateKeyframeSheet(prompt, shot.duration, visibleKeyframes.map((k) => k.timeSec), store.imageApiBaseUrl, store.imageApiKey, store.selectedImageModel, store.imageSize, store.selectedStyle);
      await applyFourGridImage(url, `镜头 ${shot.order + 1} 已按建议重新生成关键帧组图。`);
      setSuggestSheet(false);
      setSheetSuggestion('');
    } catch (e) {
      store.addToast({ kind: 'error', message: '建议重绘失败：' + (e as Error).message });
    }
    setGenSheetSuggestion(false);
  };

  const handleSuggestKeyframe = async (index: number) => {
    if (!keyframeSuggestion.trim() || !store.imageApiKey) return;
    setGenKeyframeSuggestion(true);
    try {
      const basePrompt = composeShotPrompt(shot);
      const kf = visibleKeyframes[index];
      const prompt = `${basePrompt}。第${index + 1}个关键帧（${formatTimeSec(kf.timeSec)}秒）。修改要求：${keyframeSuggestion}。必须保持与参考关键帧相同的构图和角色外观，只微调指定细节。`;
      const url = await generateImage(prompt, store.imageApiBaseUrl, store.imageApiKey, store.selectedImageModel, store.imageSize, store.selectedStyle);
      const uploadedUrl = await uploadToOss(url, store);
      const keyframes = ensureKeyframes(shot, keyframeCount).map((keyframe, frameIndex) => (
        frameIndex === index ? { ...keyframe, imageUrl: uploadedUrl } : keyframe
      ));
      store.updateShot(shot.id, { keyframes });
      store.addToast({ kind: 'success', message: `第${index + 1}个关键帧已按建议重新生成。` });
      setSuggestingKeyframeIndex(null);
      setKeyframeSuggestion('');
    } catch (e) {
      store.addToast({ kind: 'error', message: '关键帧建议重绘失败：' + (e as Error).message });
    }
    setGenKeyframeSuggestion(false);
  };

  const copyPrompt = async () => {
    try {
      const pkg = buildDoubaoShotPackage(shot, store.scriptContent);
      await navigator.clipboard.writeText(buildDoubaoShotText(pkg));
      store.addToast({ kind: 'success', message: `镜头 ${shot.order + 1} 完整模板已复制。` });
    } catch {
      store.addToast({ kind: 'error', message: '复制失败，请手动选中提示词。' });
    }
  };

  const exportCurrentShot = () => {
    const shotNo = shot.order + 1;
    const pkg = buildDoubaoShotPackage(shot, store.scriptContent);
    downloadJsonFile(`shot-${padShotNumber(shotNo)}-doubao.json`, pkg);
    store.addToast({ kind: 'success', message: `镜头 ${shotNo} 的豆包包已导出。` });
  };

  const toggleFailureDimension = (dimension: FailureDimension) => {
    const current = shot.failureDimensions || [];
    const next = current.includes(dimension) ? current.filter((item) => item !== dimension) : [...current, dimension];
    store.updateShot(shot.id, { failureDimensions: next, status: next.length > 0 ? 'needs_repair' : shot.status, reviewStatus: next.length > 0 ? 'rejected' : shot.reviewStatus });
  };

  const approveShot = () => {
    store.updateShot(shot.id, { status: 'approved', reviewStatus: 'approved', failureDimensions: [], repairPrompt: '' });
    store.addToast({ kind: 'success', message: `镜头 ${shot.order + 1} 已通过验收。` });
  };

  const markNeedsRepair = () => {
    store.updateShot(shot.id, { status: 'needs_repair', reviewStatus: 'rejected' });
  };

  const buildRepair = () => {
    const dimensions = (shot.failureDimensions || []).map((item) => FAILURE_DIMENSION_LABELS[item]).join('、') || '未标记失败维度';
    const prompt = `仅修复镜头 ${shot.order + 1} 的失败维度：${dimensions}。保留原镜头已成功的剧情、人物、服装、场景、光线、色调和构图；不要整段重写。原提示词：${composeVideoPrompt(shot)}`;
    store.updateShot(shot.id, { repairPrompt: prompt, status: 'repairing' });
    store.addToast({ kind: 'success', message: `镜头 ${shot.order + 1} 修复提示词已生成。` });
  };

  const lockEndFrame = () => {
    const fallbackFrame = visibleKeyframes[visibleKeyframes.length - 1]?.imageUrl || shot.imageUrl || '';
    store.updateShot(shot.id, { status: 'endframe_locked', endFrameUrl: shot.endFrameUrl || fallbackFrame, handoffNote: shot.handoffNote || '下一镜头继承本镜头结尾帧的人物、服装、场景、光线、视线方向和动作状态。' });
    store.addToast({ kind: 'success', message: `镜头 ${shot.order + 1} 已锁定结尾帧。` });
  };

  return (
    <div className="border border-[var(--app-border)] rounded-lg overflow-hidden bg-[var(--app-card-bg)] flex flex-col"
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(shot.order)); e.currentTarget.classList.add('opacity-50'); }}
      onDragEnd={(e) => { (e.currentTarget as HTMLElement).classList.remove('opacity-50'); }}
      onDragEnter={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-[var(--app-primary)]'); }}
      onDragLeave={(e) => { (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-[var(--app-primary)]'); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-[var(--app-primary)]');
        const from = parseInt(e.dataTransfer.getData('text/plain'));
        if (isNaN(from)) return;
        const to = shot.order;
        if (from === to) return;
        const arr = [...store.shots];
        const fromIdx = arr.findIndex(s => s.order === from);
        if (fromIdx === -1) return;
        const [item] = arr.splice(fromIdx, 1);
        const toIdx = arr.findIndex(s => s.order === to);
        arr.splice(toIdx === -1 ? arr.length : toIdx, 0, item);
        store.setShots(arr.map((s, i) => ({ ...s, order: i })));
      }}
    >
      <div className="space-y-1 px-2 py-1 bg-[var(--app-primary-light)] border-b border-[var(--app-border)]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-[var(--app-primary)]">镜 {shot.order + 1}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[var(--app-text-secondary)]">
          {showKeyframeTools && <span>{filledKeyframes}/{keyframeCount}帧</span>}
          <span>秒</span>
          <Input type="number" min={1} max={60} value={shot.duration} onChange={(e) => updateDuration(Number(e.target.value))} className="w-12 h-5 text-[10px]" />
          {showKeyframeTools && (
            <>
              <span>帧</span>
              <Input type="number" min={MIN_KEYFRAME_COUNT} max={MAX_KEYFRAME_COUNT} value={keyframeCount} onChange={(e) => setKeyframeCount(Number(e.target.value))} className="w-10 h-5 text-[10px]" />
            </>
          )}
        </div>
      </div>

      <div className="divide-y divide-[var(--app-border)]">
        {renderSection('creative', '01', '创意',
          shot.prompt ? shot.prompt.slice(0, 30) + '...' : `${shot.duration}秒 · ${shot.shotType || '中景'}`,
          <div className="p-1.5 space-y-1.5">
            <textarea className="w-full h-16 text-[10px] border border-[var(--app-border)] rounded p-1 resize-none bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:border-[var(--app-primary)]" value={localPrompt} onChange={(e) => handlePromptChange(e.target.value)} placeholder="镜头提示词" />
            <div className="grid grid-cols-3 gap-1.5">
              <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">景别</div><Select options={SHOT_TYPES.map((v) => ({ value: v, label: v }))} value={shot.shotType || ''} onChange={(e) => store.updateShot(shot.id, { shotType: e.target.value })} className="h-7 text-[10px]" /></div>
              <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">运镜</div><Select options={CAMERA_MOVES.map((v) => ({ value: v, label: v }))} value={shot.cameraMove || ''} onChange={(e) => store.updateShot(shot.id, { cameraMove: e.target.value })} className="h-7 text-[10px]" /></div>
              <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">光线</div><Select options={LIGHTING_PRESETS.map((v) => ({ value: v, label: v }))} value={shot.lighting || ''} onChange={(e) => store.updateShot(shot.id, { lighting: e.target.value })} className="h-7 text-[10px]" /></div>
              <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">色调</div><Select options={COLOR_TONES.map((v) => ({ value: v, label: v }))} value={shot.colorTone || ''} onChange={(e) => store.updateShot(shot.id, { colorTone: e.target.value })} className="h-7 text-[10px]" /></div>
              <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">主体</div><input placeholder="主体描述" value={shot.subject || ''} onChange={(e) => store.updateShot(shot.id, { subject: e.target.value })} className="h-7 w-full px-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]" /></div>
              <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">场景</div><input placeholder="场景描述" value={shot.scene || ''} onChange={(e) => store.updateShot(shot.id, { scene: e.target.value })} className="h-7 w-full px-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]" /></div>
            </div>
          </div>
        )}

        {renderSection('diagnosis', '02', '诊断',
          shot.diagnosisNotes ? shot.diagnosisNotes.slice(0, 30) + (shot.diagnosisNotes.length > 30 ? '...' : '') : '-',
          <div className="px-2 pb-1.5">
            <textarea className="w-full h-10 text-[10px] rounded border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-amber-500/5 p-1.5 resize-none text-amber-800 dark:text-amber-300 outline-none focus:border-amber-400" value={shot.diagnosisNotes || ''} onChange={(e) => store.updateShot(shot.id, { diagnosisNotes: e.target.value })} placeholder="本镜头特有风险（可选，补充总体诊断未覆盖的）" />
          </div>,
          true
        )}

        {renderSection('director', '03', '导演意图',
          shot.narrativeFunction || shot.visualFocus || '-',
          <div className="grid grid-cols-2 gap-1.5 px-2 pb-1.5">
            <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">叙事功能</div><input placeholder="如：开场铺垫" value={shot.narrativeFunction || ''} onChange={(e) => store.updateShot(shot.id, { narrativeFunction: e.target.value })} className="h-7 w-full px-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]" /></div>
            <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">视觉焦点</div><input placeholder="如：人物眼神" value={shot.visualFocus || ''} onChange={(e) => store.updateShot(shot.id, { visualFocus: e.target.value })} className="h-7 w-full px-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]" /></div>
            <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">动作开始</div><input placeholder="起始动作" value={shot.actionStart || ''} onChange={(e) => store.updateShot(shot.id, { actionStart: e.target.value })} className="h-7 w-full px-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]" /></div>
            <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">动作结束</div><input placeholder="结束动作" value={shot.actionEnd || ''} onChange={(e) => store.updateShot(shot.id, { actionEnd: e.target.value })} className="h-7 w-full px-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]" /></div>
            <div className="col-span-2"><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">导演意图 / 情绪变化</div><textarea placeholder="导演意图 / 情绪变化 / 衔接关系" className="w-full h-10 text-[10px] border border-[var(--app-border)] rounded p-1 resize-none bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:border-[var(--app-primary)]" value={shot.directorIntent || ''} onChange={(e) => store.updateShot(shot.id, { directorIntent: e.target.value })} /></div>
          </div>
        )}

        {renderSection('art', '04', '视觉风格',
          (shot.shotType || '-') + ' · ' + (shot.cameraMove || '-'),
          <div className="grid grid-cols-2 gap-1.5 px-2 pb-1.5">
            <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">景别</div><Select options={SHOT_TYPES.map((v) => ({ value: v, label: v }))} value={shot.shotType || ''} onChange={(e) => store.updateShot(shot.id, { shotType: e.target.value })} className="h-7 text-[10px]" /></div>
            <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">运镜</div><Select options={CAMERA_MOVES.map((v) => ({ value: v, label: v }))} value={shot.cameraMove || ''} onChange={(e) => store.updateShot(shot.id, { cameraMove: e.target.value })} className="h-7 text-[10px]" /></div>
            <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">光线</div><Select options={LIGHTING_PRESETS.map((v) => ({ value: v, label: v }))} value={shot.lighting || ''} onChange={(e) => store.updateShot(shot.id, { lighting: e.target.value })} className="h-7 text-[10px]" /></div>
            <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">色调</div><Select options={COLOR_TONES.map((v) => ({ value: v, label: v }))} value={shot.colorTone || ''} onChange={(e) => store.updateShot(shot.id, { colorTone: e.target.value })} className="h-7 text-[10px]" /></div>
            <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">主体</div><input placeholder="主体描述" value={shot.subject || ''} onChange={(e) => store.updateShot(shot.id, { subject: e.target.value })} className="h-7 w-full px-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]" /></div>
            <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">场景</div><input placeholder="场景描述" value={shot.scene || ''} onChange={(e) => store.updateShot(shot.id, { scene: e.target.value })} className="h-7 w-full px-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]" /></div>
          </div>
        )}

        {renderSection('space', '05', '空间锁定',
          shot.spatialLock || '-',
          <div className="px-2 pb-1.5 space-y-1">
            <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">空间锁定</div><input placeholder="左中右站位/视线/光源" value={shot.spatialLock || ''} onChange={(e) => store.updateShot(shot.id, { spatialLock: e.target.value })} className="h-7 w-full px-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]" /></div>
            <div className="grid grid-cols-2 gap-1">
              <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">前镜衔接</div><input placeholder="前镜衔接关系" value={shot.previousRelation || ''} onChange={(e) => store.updateShot(shot.id, { previousRelation: e.target.value })} className="h-7 w-full px-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]" /></div>
              <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">后镜衔接</div><input placeholder="后镜衔接关系" value={shot.nextRelation || ''} onChange={(e) => store.updateShot(shot.id, { nextRelation: e.target.value })} className="h-7 w-full px-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]" /></div>
            </div>
          </div>
        )}

        {renderSection('storyboard', '06', '参考图',
          shot.imageUrl ? (shot.keyframes?.length ? `${shot.keyframes.length}帧已生成` : '组图') : '未生成',
          <div className="p-1.5 space-y-1.5">
            {shot.imageUrl ? (
              <div>
              <div className="relative group">
                <img src={shot.imageUrl} alt="关键帧组图" className="w-full aspect-video object-cover rounded cursor-zoom-in" onClick={() => setZoomImage(shot.imageUrl)} />
                <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">关键帧组</div>
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => imgInputRef.current?.click()} className="bg-black/60 text-white p-1 rounded" title="上传"><Upload className="w-3 h-3" /></button>
                  <button onClick={handleGenImage} disabled={genImg} className="bg-black/60 text-white p-1 rounded disabled:opacity-40" title="AI生成"><RefreshCw className={`w-3 h-3 ${genImg ? 'animate-spin' : ''}`} /></button>
                  <button onClick={() => setSuggestSheet(!suggestSheet)} className="bg-black/60 text-white p-1 rounded" title="建议重绘"><Wrench className="w-3 h-3" /></button>
                  <button onClick={() => store.updateShot(shot.id, { imageUrl: '', keyframes: [] })} className="bg-black/60 text-white p-1 rounded" title="清空"><ImageOff className="w-3 h-3" /></button>
                </div>
              </div>
              {suggestSheet && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => { setSuggestSheet(false); setSheetSuggestion(''); }}>
                  <div className="w-full max-w-md bg-[var(--app-card-bg)] rounded-xl border border-[var(--app-border)] shadow-2xl p-5 mx-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-[var(--app-text)]">建议重绘 - 关键帧组图</h3><button onClick={() => { setSuggestSheet(false); setSheetSuggestion(''); }} className="text-gray-400 hover:text-[var(--app-text)]"><X className="w-4 h-4" /></button></div>
                    <img src={shot.imageUrl} alt="参考图" className="w-full aspect-video object-cover rounded-lg mb-3 border border-[var(--app-border)] cursor-zoom-in" onClick={(e) => { e.stopPropagation(); setZoomImage(shot.imageUrl); }} />
                    <textarea value={sheetSuggestion} onChange={(e) => setSheetSuggestion(e.target.value)} placeholder="输入修改建议..." className="w-full h-20 px-3 py-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-xs outline-none focus:border-[var(--app-primary)] resize-none" autoFocus />
                    <p className="text-[10px] text-gray-400 mt-1 mb-3">保持原图角色外观、场景和构图一致性。</p>
                    <div className="flex gap-2"><button onClick={() => { setSuggestSheet(false); setSheetSuggestion(''); }} className="flex-1 h-9 rounded-lg border text-xs hover:bg-[var(--app-hover)]">取消</button><button onClick={handleSuggestSheet} disabled={genSheetSuggestion || !sheetSuggestion.trim()} className="flex-1 h-9 rounded-lg bg-[var(--app-primary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40">{genSheetSuggestion ? '生成中...' : '确认重绘'}</button></div>
                  </div>
                </div>
              )}
              </div>
            ) : (
              <div className="w-full aspect-video bg-gray-100 rounded flex items-center justify-center gap-3 dark:bg-white/5">
                <button onClick={() => imgInputRef.current?.click()} className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600"><Upload className="w-5 h-5" /><span className="text-[10px]">上传组图</span></button>
                <button onClick={handleGenImage} disabled={genImg || !store.imageApiKey} className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">{genImg ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Images className="w-5 h-5" />}<span className="text-[10px]">AI组图</span></button>
              </div>
            )}
            <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadImage} />
            <input ref={frameInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadKeyframe} />
            {showKeyframeTools && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--app-text-secondary)]"><span>关键帧时间点</span><span className="truncate" title={timelineLabel}>{timelineLabel}</span></div>
              <div className="grid gap-1" style={frameGridStyle}>
                {visibleKeyframes.map((keyframe, index) => (
                  <div key={keyframe.id || index} className="relative group overflow-hidden rounded border border-[var(--app-border)] bg-[var(--app-bg-alt)] aspect-video">
                    {keyframe.imageUrl ? <img src={keyframe.imageUrl} alt={`第${formatTimeSec(keyframe.timeSec)}秒`} className="h-full w-full object-cover cursor-zoom-in" onClick={() => setZoomImage(keyframe.imageUrl)} /> : <button onClick={() => { setFrameUploadIndex(index); frameInputRef.current?.click(); }} className="flex h-full w-full items-center justify-center text-[10px] text-gray-400 hover:text-[var(--app-primary)]">+{formatTimeSec(keyframe.timeSec)}s</button>}
                    <input type="number" min={0} max={shot.duration} step={0.1} value={formatTimeSec(keyframe.timeSec)} onChange={(e) => updateKeyframeTime(index, Number(e.target.value))} className="absolute bottom-0 left-0 w-12 rounded-tr bg-black/65 px-1 py-0.5 text-[9px] text-white outline-none" />
                    {keyframe.imageUrl && (
                      <div className="absolute right-0.5 top-0.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => { setSuggestingKeyframeIndex(index); setKeyframeSuggestion(''); }} className="rounded bg-black/60 p-0.5 text-white" title="建议重绘此帧"><Wrench className="h-2.5 w-2.5" /></button>
                        <button onClick={() => { setFrameUploadIndex(index); frameInputRef.current?.click(); }} className="rounded bg-black/60 p-0.5 text-white" title="替换"><Upload className="h-2.5 w-2.5" /></button>
                        <button onClick={() => clearKeyframe(index)} className="rounded bg-black/60 p-0.5 text-white" title="移除"><ImageOff className="h-2.5 w-2.5" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {suggestingKeyframeIndex !== null && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => { setSuggestingKeyframeIndex(null); setKeyframeSuggestion(''); }}>
                  <div className="w-full max-w-md bg-[var(--app-card-bg)] rounded-xl border border-[var(--app-border)] shadow-2xl p-5 mx-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-[var(--app-text)]">建议重绘 - 第{suggestingKeyframeIndex + 1}帧</h3><button onClick={() => { setSuggestingKeyframeIndex(null); setKeyframeSuggestion(''); }} className="text-gray-400 hover:text-[var(--app-text)]"><X className="w-4 h-4" /></button></div>
                    {visibleKeyframes[suggestingKeyframeIndex]?.imageUrl && <img src={visibleKeyframes[suggestingKeyframeIndex].imageUrl} alt="参考" className="w-full aspect-video object-cover rounded-lg mb-3 border border-[var(--app-border)] cursor-zoom-in" onClick={(e) => { e.stopPropagation(); setZoomImage(visibleKeyframes[suggestingKeyframeIndex].imageUrl); }} />}
                    <textarea value={keyframeSuggestion} onChange={(e) => setKeyframeSuggestion(e.target.value)} placeholder="输入修改建议..." className="w-full h-20 px-3 py-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-xs outline-none focus:border-[var(--app-primary)] resize-none" autoFocus />
                    <p className="text-[10px] text-gray-400 mt-1 mb-3">保持原帧构图和角色外观一致性。</p>
                    <div className="flex gap-2"><button onClick={() => { setSuggestingKeyframeIndex(null); setKeyframeSuggestion(''); }} className="flex-1 h-9 rounded-lg border text-xs hover:bg-[var(--app-hover)]">取消</button><button onClick={() => handleSuggestKeyframe(suggestingKeyframeIndex)} disabled={genKeyframeSuggestion || !keyframeSuggestion.trim()} className="flex-1 h-9 rounded-lg bg-[var(--app-primary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40">{genKeyframeSuggestion ? '生成中...' : '确认重绘'}</button></div>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        )}

        {renderSection('prompt', '07', '提示词',
          shot.prompt ? shot.prompt.slice(0, 30) + '...' : '-',
          <div className="p-1.5 space-y-1">
            <textarea className="w-full h-16 text-[10px] border border-[var(--app-border)] rounded p-1 resize-none bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:border-[var(--app-primary)]" value={localPrompt} onChange={(e) => handlePromptChange(e.target.value)} placeholder="镜头提示词" />
            <textarea placeholder="全局或本镜头禁用项" className="w-full h-10 text-[10px] border border-[var(--app-border)] rounded p-1 resize-none bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:border-[var(--app-primary)]" value={shot.negativePrompt || ''} onChange={(e) => store.updateShot(shot.id, { negativePrompt: e.target.value })} />
            <textarea placeholder="备注：角色情绪、连续性..." className="w-full h-10 text-[10px] border border-[var(--app-border)] rounded p-1 resize-none bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:border-[var(--app-primary)]" value={shot.notes || ''} onChange={(e) => store.updateShot(shot.id, { notes: e.target.value })} />
          </div>
        )}

        {renderSection('review', '08', '验收',
          shot.status === 'approved' ? '已通过' : shot.status === 'needs_repair' ? '需修复' : shot.videoUrl ? '待验收' : '-',
          <div className="space-y-2 p-1.5">
            <div className="text-[10px] font-medium text-[var(--app-text)]">上传成片</div>
            <div className="flex gap-1">
              <button onClick={() => videoInputRef.current?.click()} className="flex-1 h-8 rounded border border-dashed border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text-secondary)] hover:border-[var(--app-primary)] hover:text-[var(--app-primary)] flex items-center justify-center gap-1">
                <Upload className="w-3 h-3" />本地上传
              </button>
              <input placeholder="或粘贴视频URL" value={shot.videoUrl || ''} onChange={(e) => store.updateShot(shot.id, { videoUrl: e.target.value })} className="flex-1 h-8 px-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]" />
            </div>
            {shot.videoUrl && (
              <video src={shot.videoUrl} controls className="w-full aspect-video rounded border border-[var(--app-border)] bg-black" />
            )}
            <div className="flex flex-wrap items-center gap-1">
              <Button variant="outline" size="sm" onClick={approveShot} disabled={!shot.videoUrl}><ShieldCheck className="w-3 h-3 mr-0.5" />通过</Button>
              <Button variant="outline" size="sm" onClick={markNeedsRepair} disabled={!shot.videoUrl}><Wrench className="w-3 h-3 mr-0.5" />返修</Button>
              <Button variant="outline" size="sm" onClick={handleCheckVideo} disabled={checkingVideo || !shot.videoUrl || !store.textApiKey}>
                {checkingVideo ? <Loader2 className="w-3 h-3 mr-0.5 animate-spin" /> : <Images className="w-3 h-3 mr-0.5" />}AI 验收
              </Button>
            </div>
            {capturedFrames.length > 0 && (
              <div className="flex gap-1 overflow-x-auto pb-1">
                {capturedFrames.map((frame) => (
                  <img key={frame.timeSec} src={frame.base64} alt={`${frame.timeSec}s`} className="h-12 w-auto rounded border border-[var(--app-border)] object-cover cursor-zoom-in shrink-0 hover:ring-1 hover:ring-[var(--app-primary)]" onClick={() => setZoomImage(frame.base64)} title={`${frame.timeSec}秒`} />
                ))}
              </div>
            )}
            {checkingVideo && (
              <div className="flex items-center gap-2 text-[10px] text-[var(--app-text-secondary)] py-1">
                <Loader2 className="w-3 h-3 animate-spin" />AI 验收中，正在分析 {capturedFrames.length} 帧...
              </div>
            )}
            {aiReviewResult && (
              <div className="rounded border border-[var(--app-border)] bg-[var(--app-bg)] p-2 text-[10px] leading-relaxed text-[var(--app-text)] whitespace-pre-wrap max-h-40 overflow-y-auto">{aiReviewResult}</div>
            )}
            <div className="flex flex-wrap gap-1">
              {(Object.keys(FAILURE_DIMENSION_LABELS) as FailureDimension[]).map((dimension) => (
                <button key={dimension} type="button" onClick={() => toggleFailureDimension(dimension)} className={`rounded border px-1.5 py-0.5 text-[10px] ${shot.failureDimensions?.includes(dimension) ? 'border-red-400 bg-red-500/10 text-red-500' : 'border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text-secondary)]'}`}>{FAILURE_DIMENSION_LABELS[dimension]}</button>
              ))}
            </div>
            <textarea placeholder="验收意见（通过写备注，返修写具体原因）" className="w-full h-10 text-[10px] border border-[var(--app-border)] rounded p-1 resize-none bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:border-[var(--app-primary)]" value={shot.repairNotes || ''} onChange={(e) => store.updateShot(shot.id, { repairNotes: e.target.value })} />
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleUploadVideo} />
          </div>
        )}

        {renderSection('repair', '09', '修复',
          shot.status === 'repairing' ? '修复中' : shot.status === 'needs_repair' ? '待修复' : shot.failureDimensions?.length ? `${shot.failureDimensions.length}项问题` : '-',
          <div className="space-y-2 p-1.5">
            <Button variant="outline" size="sm" onClick={buildRepair} disabled={!shot.failureDimensions?.length}>生成修复词</Button>
            <textarea placeholder="修复提示词：针对失败维度局部调整" className="w-full h-12 text-[10px] border border-[var(--app-border)] rounded p-1 resize-none bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:border-[var(--app-primary)]" value={shot.repairPrompt || ''} onChange={(e) => store.updateShot(shot.id, { repairPrompt: e.target.value })} />
          </div>
        )}

        {renderSection('endframe', '10', '结尾锁定',
          shot.endFrameUrl ? '已锁定' : shot.handoffNote ? '有继承规则' : '-',
          <div className="grid grid-cols-2 gap-1.5 p-1.5">
            <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">结尾帧 URL</div><input placeholder="贴结尾帧地址" value={shot.endFrameUrl || ''} onChange={(e) => store.updateShot(shot.id, { endFrameUrl: e.target.value })} className="h-7 w-full px-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]" /></div>
            <div><div className="text-[9px] text-[var(--app-text-muted)] mb-0.5">继承规则</div><input placeholder="下一镜头继承规则" value={shot.handoffNote || ''} onChange={(e) => store.updateShot(shot.id, { handoffNote: e.target.value })} className="h-7 w-full px-2 rounded border border-[var(--app-border)] bg-[var(--app-bg)] text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-primary)]" /></div>
            <div className="col-span-2">
              <Button variant="outline" size="sm" onClick={lockEndFrame}><Link2 className="w-3 h-3 mr-0.5" />锁定结尾帧</Button>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 px-1.5 pb-1.5">
        <Button variant="ghost" size="sm" onClick={copyPrompt}><Copy className="w-3 h-3 mr-0.5" />复制</Button>
        <Button variant="ghost" size="sm" onClick={exportCurrentShot}><Download className="w-3 h-3 mr-0.5" />导出本镜头</Button>
        {shot.videoUrl && <a href={shot.videoUrl} download className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium text-[var(--app-primary)] hover:bg-[var(--app-hover)]"><Play className="w-3 h-3 mr-0.5" />视频</a>}
        <Button variant="ghost" size="sm" className="text-red-400 ml-auto" onClick={() => store.removeShot(shot.id)}><Trash2 className="w-3 h-3" /></Button>
      </div>

      {zoomImage && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setZoomImage(null)}>
          <button onClick={() => setZoomImage(null)} className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors" title="关闭预览">
            <X className="w-5 h-5" />
          </button>
          <img src={zoomImage} alt="预览" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
