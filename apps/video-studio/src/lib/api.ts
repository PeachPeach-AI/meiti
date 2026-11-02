import type { ProjectBible, VideoTask, Shot } from '@/types';

async function proxy<T>(method: string, baseUrl: string, apiKey: string, endpoint: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'X-Api-Base-Url': baseUrl,
    'X-Api-Key': apiKey,
    'X-Api-Endpoint': endpoint,
  };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch('/api/proxy', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text.slice(0, 300) || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchModels(baseUrl: string, apiKey: string): Promise<{ id: string }[]> {
  const data = await proxy<{ data: { id: string }[] }>('GET', baseUrl, apiKey, '/models');
  return (data.data || []).filter((m) => m.id);
}

export async function testApiConnection(baseUrl: string, apiKey: string): Promise<{ count: number; firstModel?: string }> {
  const models = await fetchModels(baseUrl, apiKey);
  return { count: models.length, firstModel: models[0]?.id };
}

export function composeShotPrompt(shot: Pick<Shot, 'prompt' | 'shotType' | 'cameraMove' | 'lighting' | 'colorTone' | 'subject' | 'scene' | 'notes' | 'narrativeFunction' | 'directorIntent' | 'emotionalShift' | 'visualFocus' | 'actionStart' | 'actionEnd' | 'spatialLock' | 'negativePrompt' | 'handoffNote'>): string {
  const parts = [
    shot.prompt,
    shot.narrativeFunction && `叙事功能：${shot.narrativeFunction}`,
    shot.directorIntent && `导演意图：${shot.directorIntent}`,
    shot.emotionalShift && `情绪变化：${shot.emotionalShift}`,
    shot.visualFocus && `视觉焦点：${shot.visualFocus}`,
    shot.actionStart && `动作开始：${shot.actionStart}`,
    shot.actionEnd && `动作结束：${shot.actionEnd}`,
    shot.shotType && `景别：${shot.shotType}`,
    shot.cameraMove && `运镜：${shot.cameraMove}`,
    shot.lighting && `光线：${shot.lighting}`,
    shot.colorTone && `色调：${shot.colorTone}`,
    shot.subject && `主体：${shot.subject}`,
    shot.scene && `场景：${shot.scene}`,
    shot.spatialLock && `空间锁定：${shot.spatialLock}`,
    shot.handoffNote && `衔接要求：${shot.handoffNote}`,
    shot.negativePrompt && `禁止项：${shot.negativePrompt}`,
    shot.notes && `备注：${shot.notes}`,
  ].filter(Boolean);
  return parts.join('；');
}

export function composeVideoPrompt(shot: Shot): string {
  const base = composeShotPrompt(shot);
  const keyframes = (shot.keyframes || [])
    .filter((keyframe) => keyframe.imageUrl || keyframe.prompt)
    .sort((a, b) => a.timeSec - b.timeSec)
    .map((keyframe) => `第 ${keyframe.timeSec} 秒：${keyframe.prompt || '保持该关键帧画面主体、构图和动作状态'}`);
  if (keyframes.length === 0) return base;
  return `${base}；按关键帧时间线生成连续视频：${keyframes.join('；')}；镜头总时长 ${shot.duration} 秒，保持角色、服装、场景和画面连续性`;
}

export function primaryReferenceImage(shot: Pick<Shot, 'imageUrl' | 'keyframes'>): string | undefined {
  return (shot.keyframes || []).find((keyframe) => keyframe.imageUrl)?.imageUrl || shot.imageUrl || undefined;
}

export function referenceImageUrls(shot: Pick<Shot, 'imageUrl' | 'keyframes'>): string[] {
  const urls = (shot.keyframes || []).map((keyframe) => keyframe.imageUrl).filter(Boolean);
  if (urls.length === 0 && shot.imageUrl) return [shot.imageUrl];
  return urls;
}

export async function generateScript(input: string, mode: string, style: string, baseUrl: string, apiKey: string, model: string): Promise<string> {
  const systemPrompt = `你是一个专业的电影剧本作家。请根据用户提供的创意，创作一份详细的电影级分场景剧本。要求：200-500字，分场景叙述，包含环境描写、角色动作细节、情绪变化、光线氛围、对白。风格：${style}。必须用中文输出，直接输出剧本正文，不要加标题标注。`;
  let userContent: unknown = input;
  if (mode === 'image' && input.startsWith('data:image')) {
    userContent = [
      { type: 'image_url', image_url: { url: input } },
      { type: 'text', text: '请根据这张图片的构图、色调、氛围，创作一段电影级剧本。' },
    ];
  }

  const data = await proxy<{ choices: { message: { content: string } }[] }>('POST', baseUrl, apiKey, '/v1/chat/completions', {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.8,
    max_tokens: 4096,
  });
  return data.choices?.[0]?.message?.content || '';
}

export async function breakdownScript(script: string, shotCount: number, style: string, baseUrl: string, apiKey: string, model: string): Promise<Array<Partial<Shot> & { prompt: string; duration: number }>> {
  const systemPrompt = `你是一个专业的AI视频分镜师。把剧本拆解为 ${shotCount} 条分镜，返回纯JSON数组。每条字段：prompt,duration,shotType,cameraMove,lighting,colorTone,subject,scene,notes。prompt 用中文描述构图、动作、氛围；duration 为秒。风格：${style}。不要输出解释。`;
  const data = await proxy<{ choices: { message: { content: string } }[] }>('POST', baseUrl, apiKey, '/v1/chat/completions', {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: script },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  });
  const text = data.choices?.[0]?.message?.content || '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* fallthrough */ }
  }
  const lines = text.split('\n').filter(Boolean);
  if (lines.length > 1) {
    return lines.slice(0, shotCount).map((l) => ({ prompt: l.replace(/^\d+[\.\、\s]+/, '').trim(), duration: 4 }));
  }
  throw new Error('拆解失败，请重试');
}

export interface AutoPlanResult {
  title?: string;
  fullScript?: string;
  diagnosisNotes?: string;
  projectBible?: Partial<ProjectBible>;
  shots: Array<Partial<Shot> & { prompt: string; duration: number }>;
}

export async function autoPlanProject(input: string, mode: string, shotCount: number, style: string, baseUrl: string, apiKey: string, model: string): Promise<AutoPlanResult> {
  const systemPrompt = `你是一个AIGC影视生产制片人。用户提供了一份完整的剧本，你需要将其拆解为可执行的分镜方案。不要重写剧本——用原文作为各镜头提示词的基础。必须返回纯JSON对象，不要解释，不要Markdown。JSON结构：
{
  "fullScript": "直接返回用户提供的完整剧本原文，不要修改或缩写",
  "diagnosisNotes": "剧本诊断：冲突、情绪转折、可生成性风险、建议拆短镜头",
  "projectBible": {
    "characters": "人物库：名称：外貌/服装/特征（每行一个，格式：名称：描述）",
    "scenes": "场景库：名称：材质/光源/空间结构（每行一个，格式：名称：描述）",
    "props": "道具库：名称：颜色/材质/出现位置（每行一个，格式：名称：描述）",
    "styleRules": "整体画面质感和镜头语言",
    "colorRules": "主色、辅助色、禁用色",
    "spatialRules": "左中右站位、前中后景、视线、摄影机、光源、轴线",
    "negativeRules": "全局禁用项",
    "seedanceRules": "Seedance 2.0 生成规则、10秒项目段落、首尾帧衔接",
    "postNotes": "剪辑、字幕、声音、转场备注"
  },
  "shots": [
    {
      "prompt": "镜头画面提示词（以剧本原文措辞为基础）",
      "duration": 3,
      "shotType": "中景",
      "cameraMove": "固定",
      "lighting": "自然光",
      "colorTone": "胶片感",
      "subject": "主体",
      "scene": "场景",
      "notes": "备注",
      "narrativeFunction": "叙事功能",
      "directorIntent": "导演意图",
      "emotionalShift": "情绪变化",
      "visualFocus": "视觉焦点",
      "actionStart": "动作开始状态",
      "actionEnd": "动作结束状态",
      "previousRelation": "与上一镜头关系",
      "nextRelation": "与下一镜头关系",
      "spatialLock": "本镜头空间锁定",
      "negativePrompt": "本镜头禁用项",
      "diagnosisNotes": "本镜头特有风险",
      "handoffNote": "下一镜头继承规则"
    }
  ]
}
分镜数量建议为 ${shotCount} 个；自动规划默认按一个 10 秒项目段落分配镜头时长，所有镜头 duration 总和应尽量等于 10 秒；每个镜头要能独立生成，并考虑人物、服装、场景、空间和光线连续。风格：${style}。`;

  let userContent: unknown = input;
  if (mode === 'image' && input.startsWith('data:image')) {
    userContent = [
      { type: 'image_url', image_url: { url: input } },
      { type: 'text', text: '请根据这张图片自动规划一个AIGC影视生产方案。' },
    ];
  }

  const data = await proxy<{ choices: { message: { content: string } }[] }>('POST', baseUrl, apiKey, '/v1/chat/completions', {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.6,
    max_tokens: 8192,
  });

  const text = data.choices?.[0]?.message?.content || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('自动规划失败：模型没有返回JSON');
  const parsed = JSON.parse(jsonMatch[0]) as AutoPlanResult;
  if (!Array.isArray(parsed.shots) || parsed.shots.length === 0) throw new Error('自动规划失败：没有生成分镜');
  return parsed;
}

export async function generateKeyframeSheet(prompt: string, duration: number, keyframeTimes: number[], baseUrl: string, apiKey: string, model: string, size?: string, style?: string): Promise<string> {
  const times = keyframeTimes.length > 0 ? keyframeTimes : [0, duration];
  const data = await proxy<{ data: { url: string }[] }>('POST', baseUrl, apiKey, '/v1/images/generations', {
    model,
    prompt: `${prompt}。生成一张包含 ${times.length} 个连续关键帧的电影分镜参考图，用于一个 ${duration} 秒镜头的动作和画面变化控制。关键帧按从左到右、从上到下排列，时间点分别为：${times.map((time) => `${time}秒`).join('、')}。每格必须保持同一角色、同一服装、同一场景、同一镜头语言，只改变动作、表情、位置或镜头状态。画面中不要文字、不要数字、不要水印、不要边框标题。风格：${style || 'realistic'}。输出完整关键帧组图。`,
    n: 1,
    size: size || '1792x1024',
    ...(/volces\.com|ark\.cn-beijing|seedream|doubao/i.test(`${baseUrl} ${model}`) ? { watermark: false } : {}),
  });
  return data.data?.[0]?.url || '';
}

export async function generateImage(prompt: string, baseUrl: string, apiKey: string, model: string, size?: string, style?: string, totalShots?: number): Promise<string> {
  const stylePrefix: Record<string, string> = {
    realistic: 'cinematic film still, 35mm photography, natural lighting, shallow depth of field, anamorphic lens, professional color grading, ',
    anime: 'anime style, Studio Ghibli/Makoto Shinkai aesthetic, hand-painted, vibrant colors, beautiful composition, ',
    cinematic: 'documentary photography, available light, handheld feel, intimate, raw texture, 16mm film grain, ',
    cyberpunk: 'cyberpunk style, neon lights, rain-soaked streets, blue and purple color palette, Blade Runner aesthetic, ',
    documentary: 'photojournalism, natural available light, unposed, authentic moment, Leica M6, Kodak Portra 400, ',
    'music-video': 'MTV aesthetic, dramatic lighting, high contrast, artistic composition, music video cinematography, ',
  };
  const prefix = stylePrefix[style || 'realistic'] || stylePrefix.realistic;
  const mode = (totalShots || 1) <= 1
    ? 'single cinematic frame, precise composition'
    : 'single cinematic frame for one storyboard shot, consistent visual language across the sequence';

  const data = await proxy<{ data: { url: string }[] }>('POST', baseUrl, apiKey, '/v1/images/generations', {
    model,
    prompt: prefix + prompt + ', ' + mode + ', no text, no watermark',
    n: 1,
    size: size || '1792x1024',
    ...(/volces\.com|ark\.cn-beijing|seedream|doubao/i.test(`${baseUrl} ${model}`) ? { watermark: false } : {}),
  });
  return data.data?.[0]?.url || '';
}

export async function generateVideo(prompt: string, imageUrl: string | undefined, resolution: string, duration: number, baseUrl: string, apiKey: string, model: string, size?: string): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    prompt,
    size: size || '1920x1080',
    duration,
  };
  if (imageUrl) body.image_url = imageUrl;
  const data = await proxy<{ data: { url: string }[] } | { url: string }>('POST', baseUrl, apiKey, '/v1/video/generations', body);
  const d = data as { data?: { url: string }[]; url?: string };
  return d.data?.[0]?.url || d.url || '';
}

export function createTask(shot: Shot, taskId: string): VideoTask {
  return {
    id: taskId,
    shotId: shot.id,
    status: 'queued',
    prompt: composeVideoPrompt(shot),
    imageUrl: primaryReferenceImage(shot),
    keyframeUrls: referenceImageUrls(shot),
    createdAt: Date.now(),
  };
}
