const els = {
  fileInput: document.getElementById('fileInput'),
  emptyState: document.getElementById('emptyState'),
  workspace: document.getElementById('workspace'),
  summary: document.getElementById('summary'),
  projectSelect: document.getElementById('projectSelect'),
  shotSelect: document.getElementById('shotSelect'),
  shotTitle: document.getElementById('shotTitle'),
  shotMeta: document.getElementById('shotMeta'),
  frameCount: document.getElementById('frameCount'),
  sheetPreview: document.getElementById('sheetPreview'),
  framesPreview: document.getElementById('framesPreview'),
  promptText: document.getElementById('promptText'),
  copyPrompt: document.getElementById('copyPrompt'),
  downloadAll: document.getElementById('downloadAll'),
  copySheet: document.getElementById('copySheet'),
  copyFrame0: document.getElementById('copyFrame0'),
  urlList: document.getElementById('urlList'),
  status: document.getElementById('status'),
};

const STYLE_LABELS = {
  realistic: '电影写实',
  anime: '动漫',
  cinematic: '纪录片',
  cyberpunk: '赛博朋克',
  documentary: '纪实',
  'music-video': 'MV风格',
};

let state = {
  projects: [],
  projectIndex: 0,
  shotIndex: 0,
};

function setStatus(message, tone = 'normal') {
  els.status.textContent = message;
  els.status.style.color = tone === 'error' ? '#b91c1c' : tone === 'ok' ? '#0f766e' : '#6d746f';
}

function pad(num) {
  return String(num).padStart(3, '0');
}

function formatTimeSec(timeSec) {
  const rounded = Math.round(Number(timeSec || 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function timeSlug(timeSec) {
  return formatTimeSec(timeSec).replace('.', 'p');
}

function safeName(input) {
  return String(input || 'untitled')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'untitled';
}

function imageUrlOf(value) {
  return value?.url || value?.imageUrl || value?.src || '';
}

function mergeKeyframePlan(keyframes, keyframePlan) {
  const merged = new Map();
  const add = (item, fallbackIndex) => {
    if (!item) return;
    const timeSec = Number.isFinite(item.timeSec) ? item.timeSec : fallbackIndex;
    const index = Number.isFinite(item.index) ? item.index : fallbackIndex;
    const key = `t:${timeSec}`;
    const prev = merged.get(key) || {};
    merged.set(key, {
      ...prev,
      ...item,
      index,
      timeSec,
      prompt: item.prompt || prev.prompt || '',
      url: imageUrlOf(item) || prev.url || '',
    });
  };
  (Array.isArray(keyframePlan) ? keyframePlan : []).forEach(add);
  (Array.isArray(keyframes) ? keyframes : []).forEach(add);
  return Array.from(merged.values()).sort((a, b) => a.timeSec - b.timeSec);
}
function normalizeShot(raw, index) {
  const order = Number.isFinite(raw.order) ? raw.order : index;
  const generationMode = ['text', 'keyframes', 'sheet'].includes(raw.generationMode) ? raw.generationMode : 'sheet';
  const keyframes = generationMode === 'text' ? [] : Array.isArray(raw.keyframes) ? raw.keyframes.map((item, frameIndex) => ({
    id: item.id || `${raw.id || raw.shotId || 'shot'}-kf-${frameIndex}`,
    index: Number.isFinite(item.index) ? item.index : frameIndex,
    timeSec: Number.isFinite(item.timeSec) ? item.timeSec : frameIndex,
    prompt: item.prompt || '',
    url: imageUrlOf(item),
  })).sort((a, b) => a.timeSec - b.timeSec) : [];

  return {
    id: raw.id || raw.shotId || `shot-${pad(order + 1)}`,
    order,
    prompt: raw.prompt || raw.basePrompt || '',
    packagePrompt: raw.packagePrompt || '',
    generationMode,
    sheetUrl: generationMode === 'sheet' ? (raw.sheetUrl || raw.imageUrl || raw.sheet?.url || '') : '',
    keyframes,
    videoUrl: raw.videoUrl || '',
    duration: Number(raw.duration) > 0 ? Number(raw.duration) : 4,
    style: raw.style || '',
    resolution: raw.resolution || '',
    frameRate: raw.frameRate || '',
    shotType: raw.shotType || '',
    cameraMove: raw.cameraMove || '',
    lighting: raw.lighting || '',
    colorTone: raw.colorTone || '',
    subject: raw.subject || '',
    scene: raw.scene || '',
    notes: raw.notes || '',
  };
}

function normalizeProject(raw, index) {
  const shots = Array.isArray(raw.shots) ? raw.shots.map(normalizeShot) : [];
  return {
    id: raw.id || raw.projectId || `project-${pad(index + 1)}`,
    title: raw.title || raw.name || `项目 ${index + 1}`,
    createdAt: raw.createdAt || Date.now(),
    scriptContent: raw.scriptContent || raw.script || '',
    shots,
  };
}

function normalizeSingleShotPackage(data) {
  const order = Number(data.order) > 0 ? Number(data.order) - 1 : 0;
  return normalizeProject({
    id: data.projectId || 'doubao-shot-package',
    title: data.projectTitle || `镜头 ${order + 1}`,
    createdAt: data.exportedAt ? Date.parse(data.exportedAt) : Date.now(),
    scriptContent: data.scriptContent || '',
    shots: [{
      id: data.shotId,
      order,
      prompt: data.basePrompt || data.prompt || '',
      packagePrompt: data.prompt || '',
      generationMode: data.generationMode || 'sheet',
      sheetUrl: data.generationMode === 'sheet' ? (data.sheet?.url || '') : '',
      keyframes: data.generationMode === 'text' ? [] : mergeKeyframePlan(data.keyframes, data.keyframePlan),
      duration: data.duration,
      style: data.style,
      resolution: data.resolution,
      frameRate: data.frameRate,
      shotType: data.shotType,
      cameraMove: data.cameraMove,
      lighting: data.lighting,
      colorTone: data.colorTone,
      subject: data.subject,
      scene: data.scene,
      notes: data.notes,
    }],
  }, 0);
}

function normalizePackage(data) {
  if (data?.type === 'doubao-shot-package') return [normalizeSingleShotPackage(data)];
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data.records)
      ? data.records
      : Array.isArray(data.projects)
        ? data.projects
        : Array.isArray(data.shots)
          ? [data]
          : [];
  return list.map(normalizeProject).filter((project) => project.shots.length > 0);
}

function currentProject() {
  return state.projects[state.projectIndex];
}

function currentShot() {
  return currentProject()?.shots[state.shotIndex];
}

function composeBasePrompt(shot) {
  return [
    shot.prompt,
    shot.shotType && `景别：${shot.shotType}`,
    shot.cameraMove && `运镜：${shot.cameraMove}`,
    shot.lighting && `光线：${shot.lighting}`,
    shot.colorTone && `色调：${shot.colorTone}`,
    shot.subject && `主体：${shot.subject}`,
    shot.scene && `场景：${shot.scene}`,
    shot.notes && `备注：${shot.notes}`,
  ].filter(Boolean).join('；');
}

function composeDoubaoPrompt(project, shot) {
  const shotNo = shot.order + 1;
  const style = STYLE_LABELS[shot.style] || shot.style || '电影写实';
  const isTextMode = shot.generationMode === 'text';
  const frames = isTextMode ? [] : shot.keyframes.filter((frame) => frame.url || frame.prompt);
  const frameLines = frames.length > 0
    ? frames.map((frame) => `第 ${formatTimeSec(frame.timeSec)} 秒：${frame.prompt || '参考上传的对应关键帧画面，保持主体、构图和动作状态'}${frame.url ? `\n参考图：${frame.url}` : ''}`).join('\n')
    : '未提供关键帧参考图；可直接按镜头提示词生成，或按关键帧时间点补充参考图。';
  const urlLines = collectShotImages(shot).map((item) => `${item.label}：${item.url}`).join('\n') || '未提供图片链接。';
  const timeline = shot.keyframes.length > 0 ? `${shot.keyframes.map((frame) => formatTimeSec(frame.timeSec)).join('s / ')}s` : '未设置';
  const modeName = { text: '纯文本', keyframes: '关键帧', sheet: '组图切割' }[shot.generationMode] || '组图切割';
  const keyframeMeta = isTextMode ? '' : `\n关键帧数量：${shot.keyframes.length}\n关键帧时间点：${timeline}`;
  const referenceSection = isTextMode ? '' : `\n\n【参考图上传顺序】\n${urlLines}\n\n【关键帧时间线】\n${frameLines}`;
  const requirement = isTextMode
    ? `请根据镜头提示词生成连续 ${shot.duration} 秒视频。参考图不是必需项，保持同一人物、服装、场景、光线、色调和构图连续。不要出现文字、水印、变脸、肢体畸变、画面跳变。`
    : `请生成连续 ${shot.duration} 秒视频。参考图为可选项；如已上传关键帧参考图，请严格按对应时间点过渡；未上传时，请按镜头提示词和关键帧时间点生成画面变化。保持同一人物、服装、场景、光线、色调和构图连续。不要出现文字、水印、变脸、肢体畸变、画面跳变。`;

  return `【项目】${project.title}\n【镜头 ${shotNo}】\n创建方式：${modeName}\n时长：${shot.duration} 秒${keyframeMeta}\n画幅：16:9\n风格：${style}\n分辨率：${shot.resolution || '按平台默认'}\n帧率：${shot.frameRate || '按平台默认'}\n\n【镜头提示词】\n${composeBasePrompt(shot)}${referenceSection}\n\n【视频生成要求】\n${requirement}`;
}

function collectShotImages(shot) {
  const items = [];
  if (shot.sheetUrl) items.push({ label: '关键帧组图', url: shot.sheetUrl, kind: 'sheet' });
  for (const frame of shot.keyframes) {
    if (frame.url) items.push({ label: `第 ${frame.timeSec} 秒关键帧`, url: frame.url, kind: 'keyframe', timeSec: frame.timeSec });
  }
  return items;
}

function renderProjectOptions() {
  els.projectSelect.innerHTML = '';
  state.projects.forEach((project, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${project.title} (${project.shots.length})`;
    els.projectSelect.appendChild(option);
  });
  els.projectSelect.value = String(state.projectIndex);
}

function renderShotOptions() {
  const project = currentProject();
  els.shotSelect.innerHTML = '';
  if (!project) return;
  project.shots.forEach((shot, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `镜头 ${shot.order + 1} · ${shot.duration}s · ${shot.keyframes.filter((f) => f.url).length}/${shot.keyframes.length || 0}帧`;
    els.shotSelect.appendChild(option);
  });
  state.shotIndex = Math.min(state.shotIndex, project.shots.length - 1);
  els.shotSelect.value = String(state.shotIndex);
}

function setPreviewBackground(element, url) {
  element.style.backgroundImage = url ? `url("${url.replace(/"/g, '%22')}")` : '';
  element.disabled = !url;
}

function renderFrames(shot) {
  els.framesPreview.innerHTML = '';
  const frames = [...shot.keyframes].sort((a, b) => a.timeSec - b.timeSec);
  els.framesPreview.style.gridTemplateColumns = `repeat(${Math.min(4, Math.max(1, frames.length))}, minmax(0, 1fr))`;
  if (frames.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'frame preview';
    empty.innerHTML = '<span>无关键帧</span>';
    els.framesPreview.appendChild(empty);
    return;
  }
  frames.forEach((frame) => {
    const button = document.createElement('button');
    button.className = 'frame preview';
    const time = formatTimeSec(frame.timeSec);
    button.title = frame.url ? `复制第 ${time} 秒关键帧` : `第 ${time} 秒无图`;
    button.innerHTML = `<span>${time}s</span>`;
    setPreviewBackground(button, frame.url);
    button.addEventListener('click', () => copyImage(frame.url, `第 ${time} 秒关键帧`));
    els.framesPreview.appendChild(button);
  });
}

function render() {
  const hasProjects = state.projects.length > 0;
  els.emptyState.classList.toggle('hidden', hasProjects);
  els.workspace.classList.toggle('hidden', !hasProjects);
  if (!hasProjects) {
    els.summary.textContent = '导入项目 JSON 后选择镜头';
    return;
  }

  renderProjectOptions();
  renderShotOptions();

  const project = currentProject();
  const shot = currentShot();
  if (!project || !shot) return;

  const framesWithUrl = shot.keyframes.filter((frame) => frame.url).length;
  els.summary.textContent = `${state.projects.length} 个项目，当前 ${project.shots.length} 个镜头`;
  els.shotTitle.textContent = `镜头 ${shot.order + 1}`;
  els.shotMeta.textContent = `${shot.duration}s · ${STYLE_LABELS[shot.style] || shot.style || '默认风格'} · ${shot.shotType || '未设景别'} · ${shot.cameraMove || '未设运镜'}`;
  els.frameCount.textContent = `${framesWithUrl}/${shot.keyframes.length || 0}`;
  setPreviewBackground(els.sheetPreview, shot.sheetUrl);
  renderFrames(shot);
  els.promptText.value = composeDoubaoPrompt(project, shot);
  els.urlList.textContent = collectShotImages(shot).map((item) => `${item.label}\n${item.url}`).join('\n\n') || '当前镜头没有图片地址。';
  els.copySheet.disabled = !shot.sheetUrl;
  els.copyFrame0.disabled = !shot.keyframes.find((frame) => frame.url);
}

function persist() {
  chrome.storage.local.set({ doubaoShotHelper: state });
}

async function loadPersisted() {
  const data = await chrome.storage.local.get('doubaoShotHelper');
  if (data.doubaoShotHelper?.projects?.length) {
    state = data.doubaoShotHelper;
    render();
    setStatus('已恢复上次导入的项目', 'ok');
  }
}

async function importFile(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  const projects = normalizePackage(data);
  if (projects.length === 0) throw new Error('JSON 中没有可识别的 shots 数据');
  state = { projects, projectIndex: 0, shotIndex: 0 };
  persist();
  render();
  setStatus(`已导入 ${projects.length} 个项目`, 'ok');
}

function extensionFromUrl(url) {
  if (url.startsWith('data:image/png')) return 'png';
  if (url.startsWith('data:image/webp')) return 'webp';
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'jpg';
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]+)$/);
    return match?.[1]?.slice(0, 5) || 'jpg';
  } catch {
    return 'jpg';
  }
}

function downloadUrl(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(downloadId);
    });
  });
}

async function downloadCurrentShot() {
  const project = currentProject();
  const shot = currentShot();
  const images = collectShotImages(shot);
  if (images.length === 0) {
    setStatus('当前镜头没有可下载图片', 'error');
    return;
  }
  const base = `video-studio/${safeName(project.title || project.id)}/shot-${pad(shot.order + 1)}`;
  for (const item of images) {
    const ext = extensionFromUrl(item.url);
    const name = item.kind === 'sheet'
      ? `shot-${pad(shot.order + 1)}-sheet.${ext}`
      : `shot-${pad(shot.order + 1)}-kf-${timeSlug(item.timeSec)}.${ext}`;
    await downloadUrl(item.url, `${base}/${name}`);
  }
  setStatus(`已开始下载 ${images.length} 张图片`, 'ok');
}

function dataUrlToBlob(dataUrl) {
  const [head, body] = dataUrl.split(',');
  const mime = head.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function fetchImageBlob(url) {
  if (!url) throw new Error('没有图片地址');
  if (url.startsWith('data:image/')) return dataUrlToBlob(url);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`图片下载失败 HTTP ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error(`返回内容不是图片：${blob.type || 'unknown'}`);
  return blob;
}

function canvasToBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('图片转换失败')), type, quality);
  });
}

async function toPngBlob(blob) {
  if (blob.type === 'image/png') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return canvasToBlob(canvas, 'image/png');
}

async function copyImage(url, label) {
  try {
    const blob = await fetchImageBlob(url);
    const png = await toPngBlob(blob);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    setStatus(`${label} 已复制，可到豆包输入框 Ctrl+V`, 'ok');
  } catch (err) {
    setStatus(`${label} 复制失败：${err.message}`, 'error');
  }
}

async function copyPrompt() {
  const text = els.promptText.value;
  if (!text) return;
  await navigator.clipboard.writeText(text);
  setStatus('提示词已复制', 'ok');
}

els.fileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await importFile(file);
  } catch (err) {
    setStatus(`导入失败：${err.message}`, 'error');
  } finally {
    event.target.value = '';
  }
});

els.projectSelect.addEventListener('change', () => {
  state.projectIndex = Number(els.projectSelect.value);
  state.shotIndex = 0;
  persist();
  render();
});

els.shotSelect.addEventListener('change', () => {
  state.shotIndex = Number(els.shotSelect.value);
  persist();
  render();
});

els.copyPrompt.addEventListener('click', copyPrompt);
els.downloadAll.addEventListener('click', downloadCurrentShot);
els.copySheet.addEventListener('click', () => copyImage(currentShot()?.sheetUrl, '关键帧组图'));
els.sheetPreview.addEventListener('click', () => copyImage(currentShot()?.sheetUrl, '关键帧组图'));
els.copyFrame0.addEventListener('click', () => {
  const frame = currentShot()?.keyframes.find((item) => item.url);
  copyImage(frame?.url, frame ? `第 ${formatTimeSec(frame.timeSec)} 秒关键帧` : '首个关键帧');
});

loadPersisted().then(render).catch((err) => setStatus(`初始化失败：${err.message}`, 'error'));