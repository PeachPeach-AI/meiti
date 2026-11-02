'use client';
import { useRef, useState } from 'react';
import { Trash2, Search, ChevronDown, ChevronUp, Play, RotateCcw, Download, Upload, ImageOff, VideoOff } from 'lucide-react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ProjectRecord } from '@/types';

const PAGE_SIZE = 8;

function hasVideo(record: ProjectRecord) {
  return Boolean(record.videoUrl || record.shots.some((s) => s.videoUrl));
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ResultsPanel() {
  const store = useAppStore();
  const { projectRecords, historySearch, historyPage, historyFilter } = store;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  let filtered = projectRecords;
  if (historyFilter === 'withVideo') filtered = filtered.filter(hasVideo);
  if (historyFilter === 'noVideo') filtered = filtered.filter((r) => !hasVideo(r));
  if (historySearch) {
    const q = historySearch.toLowerCase();
    filtered = filtered.filter((r) => (r.title || '').toLowerCase().includes(q) || r.scriptContent.toLowerCase().includes(q));
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = filtered.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE);

  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);

  const handleApply = (r: ProjectRecord) => {
    store.setScriptContent(r.scriptContent);
    store.setShots(r.shots);
    store.addToast({ kind: 'success', message: '项目已应用到当前工作区。' });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const records: ProjectRecord[] = Array.isArray(data) ? data : Array.isArray(data.records) ? data.records : [data];
      const normalized = records.filter((r) => r && Array.isArray(r.shots)).map((r) => ({
        ...r,
        id: r.id || crypto.randomUUID(),
        title: r.title || '导入项目',
        scriptContent: r.scriptContent || '',
        createdAt: r.createdAt || Date.now(),
      }));
      if (normalized.length === 0) throw new Error('没有可导入的项目记录');
      store.importProjectRecords(normalized);
      store.addToast({ kind: 'success', message: `已导入 ${normalized.length} 个项目。` });
    } catch (err) {
      store.addToast({ kind: 'error', message: '导入失败：' + (err as Error).message });
    } finally {
      e.target.value = '';
    }
  };

  const updateShotInRecord = (record: ProjectRecord, shotId: string, patch: Partial<ProjectRecord['shots'][number]>) => {
    store.updateProjectRecord(record.id, { shots: record.shots.map((s) => (s.id === shotId ? { ...s, ...patch } : s)) });
  };

  const removeKeyframeInRecord = (record: ProjectRecord, shotId: string, keyframeId: string) => {
    store.updateProjectRecord(record.id, {
      shots: record.shots.map((s) => (s.id === shotId ? { ...s, keyframes: (s.keyframes || []).map((keyframe) => (keyframe.id === keyframeId ? { ...keyframe, imageUrl: '' } : keyframe)) } : s)),
    });
  };

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--app-text)]">生成记录 {projectRecords.length > 0 && `(${projectRecords.length})`}</h2>
          <p className="mt-0.5 text-[11.5px] text-[var(--app-text-muted)]">项目历史与导出</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => importRef.current?.click()}><Upload className="w-3 h-3" />导入</Button>
          <Button variant="ghost" size="sm" disabled={projectRecords.length === 0} onClick={() => downloadJson('video-studio-projects.json', { records: projectRecords })}><Download className="w-3 h-3" />全部</Button>
          {projectRecords.length > 0 && (
            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => { if (confirm('清空所有记录？')) { store.clearProjectRecords(); store.addToast({ kind: 'info', message: '历史记录已清空。' }); } }}>
              <Trash2 className="w-3 h-3" />清空
            </Button>
          )}
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
        </div>
      </div>

      <Input placeholder="搜索项目名或剧本内容..." value={historySearch} onChange={(e) => store.setHistorySearch(e.target.value)} icon={<Search className="w-3 h-3" />} />
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--app-bg-alt)] p-0.5">
        {([
          ['all', '全部'],
          ['withVideo', '有视频'],
          ['noVideo', '无视频'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => store.setHistoryFilter(key)} className={`rounded-md py-1.5 text-[11px] font-medium ${historyFilter === key ? 'bg-[var(--app-primary)] text-white' : 'text-gray-500 hover:text-[var(--app-text)]'}`}>{label}</button>
        ))}
      </div>

      {page.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">暂无记录，生成视频后自动保存</div>
      ) : (
        <div className="flex flex-col gap-2">
          {page.map((r) => {
            const isExpanded = expandedId === r.id;
            const shotImages = r.shots.filter((s) => s.imageUrl);
            const shotKeyframes = r.shots.flatMap((s) => (s.keyframes || []).filter((keyframe) => keyframe.imageUrl).map((keyframe) => ({ shot: s, keyframe })));
            const shotVideos = r.shots.filter((s) => s.videoUrl);
            return (
              <div key={r.id} className="border border-[var(--app-border)] rounded-lg overflow-hidden bg-[var(--app-card-bg)]">
                <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[var(--app-hover)]" onClick={() => toggleExpand(r.id)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-xs text-[var(--app-text)] truncate">{r.title || r.scriptContent.slice(0, 30) || '(无脚本)'}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasVideo(r) && <Play className="w-3 h-3 text-[var(--app-primary)]" />}
                    <span className="text-[10px] text-gray-400">{r.shots.length} 镜头</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-[var(--app-border)] p-3 space-y-2">
                    <input value={r.title || ''} placeholder="项目名称" onChange={(e) => store.updateProjectRecord(r.id, { title: e.target.value })} className="w-full h-8 px-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-xs text-[var(--app-text)] focus:outline-none focus:border-[var(--app-primary)]" />
                    {r.scriptContent && (
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">剧本</div>
                        <div className="text-xs text-[var(--app-text-secondary)] bg-[var(--app-bg-alt)] rounded p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">{r.scriptContent}</div>
                      </div>
                    )}
                    {shotImages.length > 0 && (
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">分镜参考图 ({shotImages.length})</div>
                        <div className="grid grid-cols-3 gap-1">
                          {shotImages.map((s) => (
                            <div key={s.id} className="relative group">
                              <img src={s.imageUrl} className="w-full aspect-video object-cover rounded" alt="分镜参考图" />
                              <button title="移除图片" onClick={() => updateShotInRecord(r, s.id, { imageUrl: '' })} className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"><ImageOff className="h-3 w-3" /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {shotKeyframes.length > 0 && (
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">关键帧 ({shotKeyframes.length})</div>
                        <div className="grid grid-cols-4 gap-1">
                          {shotKeyframes.map(({ shot, keyframe }) => (
                            <div key={keyframe.id} className="relative group overflow-hidden rounded bg-[var(--app-bg-alt)]">
                              <img src={keyframe.imageUrl} className="w-full aspect-video object-cover" alt="关键帧参考图" />
                              <span className="absolute bottom-0 left-0 bg-black/60 px-1 text-[9px] text-white">镜{shot.order + 1} · {keyframe.timeSec}s</span>
                              <button title="移除关键帧" onClick={() => removeKeyframeInRecord(r, shot.id, keyframe.id)} className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"><ImageOff className="h-3 w-3" /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {shotVideos.length > 0 ? (
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">生成的视频 ({shotVideos.length})</div>
                        <div className="space-y-2">
                          {shotVideos.map((s) => (
                            <div key={s.id} className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-gray-400">
                                <span>镜头 {s.order + 1}</span>
                                <button onClick={() => updateShotInRecord(r, s.id, { videoUrl: undefined })} className="inline-flex items-center gap-1 text-red-400"><VideoOff className="h-3 w-3" />移除</button>
                              </div>
                              <video src={s.videoUrl} className="w-full rounded" controls />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : r.videoUrl && (
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">生成的视频</div>
                        <video src={r.videoUrl} className="w-full rounded" controls />
                      </div>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleApply(r); }}><RotateCcw className="w-3 h-3 mr-1" />应用</Button>
                      <Button variant="ghost" size="sm" onClick={() => downloadJson(`${r.title || r.id}.json`, r)}><Download className="w-3 h-3 mr-1" />导出</Button>
                      <Button variant="ghost" size="sm" className="text-red-400" onClick={(e) => { e.stopPropagation(); store.removeProjectRecord(r.id); store.addToast({ kind: 'info', message: '项目记录已删除。' }); }}><Trash2 className="w-3 h-3 mr-1" />删除</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={historyPage <= 1} onClick={() => store.setHistoryPage(historyPage - 1)}>上一页</Button>
          <span className="text-xs text-gray-400">{historyPage} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={historyPage >= totalPages} onClick={() => store.setHistoryPage(historyPage + 1)}>下一页</Button>
        </div>
      )}
    </div>
  );
}