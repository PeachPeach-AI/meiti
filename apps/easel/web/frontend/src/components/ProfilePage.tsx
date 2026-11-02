import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { fetchPersonas, fetchPersonaFiles, savePersonaFile, deletePersona, fetchAccountAnalytics, fetchOutputs, fetchKnowledge, saveKnowledge } from '../lib/api';
import type { PersonaFile, PersonaItem, AccountAnalytics, OutputNode } from '../lib/api';
import { renderMarkdown } from '../lib/sanitize';
import { IconProfile } from './icons';

// 粉丝量级：把粉丝数映射成人话档位（画像里“粉丝量级”一栏要的是量级而非精确值）
function fanTier(n: number): string {
  if (n <= 0) return '新号 / 0';
  if (n < 500) return '冷启动 <500';
  if (n < 1000) return '数百';
  if (n < 5000) return '千级';
  if (n < 10000) return '数千';
  if (n < 100000) return '万级';
  if (n < 1000000) return '十万级';
  return '百万+';
}

// 用注释围栏包住自动抓取段，重复抓取只替换该段、不动用户手写内容（幂等）
const WX_START = '<!-- wechat-oa:auto:start -->';
const WX_END = '<!-- wechat-oa:auto:end -->';

function buildWechatBlock(a: AccountAnalytics): string {
  const fans = a.followers ?? 0;
  const posts = a.posts ?? 0;
  const reads = a.likes ?? 0;
  const tops = [...new Set(a.notes.map((n) => n.title).filter(Boolean))].slice(0, 3);
  const stamp = new Date().toLocaleString('zh-CN', { hour12: false });
  const lines = [
    `### 微信公众号（自动抓取 · ${stamp}）`,
    '',
    `- **粉丝量级**：${fans}（${fanTier(fans)}）`,
    `- **内容形式**：图文推文（公众号文章）；已发表 ${posts} 篇${reads ? `，累计阅读 ${reads}` : ''}`,
  ];
  if (a.metrics?.length) {
    lines.push(`- **后台数据**：${a.metrics.map((m) => `${m.label} ${m.value}`).join(' · ')}`);
  }
  if (tops.length) lines.push(`- **代表内容**：${tops.join('｜')}`);
  return lines.join('\n');
}

function mergeWechatBlock(existing: string, block: string): string {
  const wrapped = `${WX_START}\n${block}\n${WX_END}`;
  const s = existing.indexOf(WX_START);
  const e = existing.indexOf(WX_END);
  if (s !== -1 && e !== -1 && e > s) {
    return existing.slice(0, s) + wrapped + existing.slice(e + WX_END.length);
  }
  const head = existing.replace(/\s+$/, '');
  return head ? `${head}\n\n${wrapped}` : wrapped;
}

interface ProfilePageProps {
  personas: PersonaItem[];
  persona?: string;
  onNewProfile: () => void;
  onDeleted: (name: string) => void;
}

const CARD_GRADIENTS = [
  'linear-gradient(135deg,#F26B5E,#F59A87)',
  'linear-gradient(135deg,#4A5BD6,#7C86E8)',
  'linear-gradient(135deg,#2BA39A,#5FD0C4)',
  'linear-gradient(135deg,#8B5CF6,#B08CFF)',
];

const DIM_META: Record<string, { label: string; icon: string }> = {
  'identity.md': { label: '身份定位', icon: '🪪' },
  'style.md': { label: '内容风格', icon: '🎨' },
  'audience.md': { label: '目标受众', icon: '👥' },
  'platforms.md': { label: '平台运营', icon: '📱' },
  'preferences.md': { label: '偏好与红线', icon: '⚖️' },
  'memory.md': { label: '经验沉淀', icon: '🧠' },
};

function PersonIcon({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8.2" r="3.5" />
      <path d="M4.6 19.6c0-3.5 3.3-6 7.4-6s7.4 2.5 7.4 6v.4H4.6z" />
    </svg>
  );
}

export default function ProfilePage({ personas, onNewProfile, onDeleted }: ProfilePageProps) {
  const [list, setList] = useState<PersonaItem[]>(personas || []);
  const [activeName, setActiveName] = useState('');
  const [files, setFiles] = useState<PersonaFile[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingFile, setSavingFile] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');
  const [fetchingWx, setFetchingWx] = useState(false);
  // 知识库挂载（按画像）：内容来源是内容库文件/文件夹，仅入口与画像绑定
  const [kbOpen, setKbOpen] = useState(false);
  const [kbDraft, setKbDraft] = useState<string[]>([]);
  const [kbBusy, setKbBusy] = useState(false);
  const [kbRoots, setKbRoots] = useState<OutputNode[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbError, setKbError] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };
  const closeDrawer = () => { setActiveName(''); setEditing(false); };

  const refreshList = useCallback(() => {
    fetchPersonas().then((l) => setList(l || [])).catch(() => setError('刷新画像列表失败'));
  }, []);

  useEffect(() => { setList(personas || []); }, [personas]);

  useEffect(() => {
    if (!activeName) { setFiles([]); return; }
    let ignore = false;
    setLoading(true);
    setError('');
    setEditing(false);
    fetchPersonaFiles(activeName)
      .then((d) => {
        if (ignore) return;
        setFiles(d.files);
        setDrafts(Object.fromEntries(d.files.map((f) => [f.filename, f.content])));
      })
      .catch(() => { if (!ignore) setError('加载画像失败'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [activeName]);

  // Esc 关闭抽屉
  useEffect(() => {
    if (!activeName) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeName]);

  const handleSave = async (filename: string) => {
    setSavingFile(filename);
    try {
      await savePersonaFile(activeName, filename, drafts[filename] ?? '');
      setFiles((prev) => prev.map((f) => f.filename === filename ? { ...f, content: drafts[filename] ?? '' } : f));
      showToast(`已保存 ${DIM_META[filename]?.label || filename} ✓`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingFile('');
    }
  };

  // 「平台运营」一键抓取公众号数据：抓完直接落盘并刷新视图
  const handleFetchWechat = async (filename: string) => {
    setFetchingWx(true);
    try {
      const a = await fetchAccountAnalytics('wechat-oa');
      if (!a.loggedIn) {
        showToast('公众号后台未登录：请先到「账号」页扫码登录后再抓取');
        return;
      }
      const base = files.find((f) => f.filename === filename)?.content ?? '';
      const merged = mergeWechatBlock(base, buildWechatBlock(a));
      await savePersonaFile(activeName, filename, merged);
      setFiles((prev) => prev.map((f) => f.filename === filename ? { ...f, content: merged } : f));
      setDrafts((p) => ({ ...p, [filename]: merged }));
      showToast(`已抓取并更新画像（粉丝 ${a.followers ?? 0}，已发表 ${a.posts ?? 0} 篇）✓`);
    } catch (e) {
      showToast(e instanceof Error ? `抓取失败：${e.message}` : '抓取失败（可能未登录或平台改版）');
    } finally {
      setFetchingWx(false);
    }
  };

  const doDelete = async (name: string) => {
    if (!window.confirm(`确定删除画像「${name}」吗？\n此操作不可恢复，将删除该画像的全部六维文件。`)) return;
    setDeleting(true);
    try {
      await deletePersona(name);
      onDeleted(name);
      setList((prev) => prev.filter((p) => p.name !== name));
      if (activeName === name) closeDrawer();
      showToast(`已删除画像「${name}」`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  // 打开知识库挂载：加载内容库树 + 该画像已挂载的路径
  const openKb = useCallback(async () => {
    if (!activeName) return;
    setKbOpen(true);
    setKbLoading(true);
    setKbError('');
    try {
      const [roots, kb] = await Promise.all([
        fetchOutputs(),
        fetchKnowledge(activeName).catch(() => ({ paths: [] as string[] })),
      ]);
      setKbRoots(roots || []);
      setKbDraft(kb.paths || []);
    } catch {
      setKbError('加载内容库失败');
    } finally {
      setKbLoading(false);
    }
  }, [activeName]);

  const toggleKb = useCallback((path: string) => {
    setKbDraft((prev) => {
      if (prev.includes(path)) {
        return prev.filter((p) => p !== path && !p.startsWith(path + '/'));
      }
      const next = prev.filter((p) => !path.startsWith(p + '/'));
      return [...next, path];
    });
  }, []);

  const saveKb = useCallback(async () => {
    if (!activeName) return;
    setKbBusy(true);
    try {
      const r = await saveKnowledge(activeName, kbDraft);
      setKbDraft(r.paths || []);
      setKbOpen(false);
      showToast(`知识库挂载已保存（${(r.paths || []).length} 项）`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存知识库失败');
    } finally {
      setKbBusy(false);
    }
  }, [activeName, kbDraft, showToast]);

  const renderKbNode = (node: OutputNode, depth: number): ReactNode => {
    const isDir = node.type === 'dir';
    const children = node.children || [];
    const row = (
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'pointer' }}
        onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={kbDraft.includes(node.path)} onChange={() => toggleKb(node.path)} />
        <span>{node.title || node.name}</span>
        {isDir && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {node.fileCount != null ? `${node.fileCount} 个文件` : ''}
        </span>}
      </label>
    );
    if (!isDir || children.length === 0) {
      return <div key={node.path} style={{ paddingLeft: depth * 14 }}>{row}</div>;
    }
    return (
      <details key={node.path} open={depth < 1} style={{ paddingLeft: depth * 14 }}>
        <summary style={{ cursor: 'pointer' }}>{row}</summary>
        <div style={{ paddingLeft: 14 }}>{children.map((c) => renderKbNode(c, depth + 1))}</div>
      </details>
    );
  };

  return (
    <div className="persona-page">
      <div className="persona-page-head">
        <div>
          <h1 className="page-title">
            <IconProfile size={21} /> 用户画像
          </h1>
          <p className="page-subtitle">共 {list.length} 个画像。点卡片查看/编辑它的六维人设。</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={refreshList}>刷新</button>
          <button className="btn btn-primary" onClick={onNewProfile}>+ 新建画像</button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--red)', maxWidth: 1100, margin: '16px auto' }}>{error}</div>}

      {list.length === 0 ? (
        <div className="empty-state" style={{ height: 300, maxWidth: 1100, margin: '24px auto' }}>
          <div className="empty-icon">👤</div>
          <h3>还没有画像</h3>
          <p>画像沉淀你的定位、风格、受众与红线，生成内容会更贴合你的人设。</p>
          <button className="btn btn-primary" onClick={onNewProfile}>+ 新建画像</button>
        </div>
      ) : (
        <div className="persona-grid">
          {list.map((p, i) => (
            <div key={p.name} className="persona-card" onClick={() => setActiveName(p.name)}>
              <div className="persona-card-top" style={{ background: CARD_GRADIENTS[i % CARD_GRADIENTS.length] }}>
                <span className="persona-badge">画像</span>
                <button className="persona-del" title="删除画像" disabled={deleting}
                  onClick={(e) => { e.stopPropagation(); doDelete(p.name); }}>🗑</button>
                <span className="persona-avatar"><PersonIcon size={64} /></span>
              </div>
              <div className="persona-card-body">
                <div className="persona-name">{p.name}</div>
                <div className="persona-desc">{p.description || '（暂无描述）'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeName && (
        <div className="drawer-overlay" onClick={closeDrawer}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{activeName}</h2>
                  <p className="page-subtitle" style={{ marginTop: 6 }}>六个维度构成一个完整人设，可随时编辑保存。</p>
                </div>
                <button className="icon-btn" onClick={closeDrawer} title="关闭（Esc）">✕</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => showToast('封面管理暂未接入')}>🖼 封面</button>
                <button className="btn" onClick={() => void openKb()} disabled={kbBusy}
                  title="选择内容库中作为本画像知识库的内容（Agent 对话可读取）">
                  📚 知识库{kbDraft.length ? ` ${kbDraft.length}` : ''}
                </button>
                <button className={`btn${editing ? ' btn-primary' : ''}`} onClick={() => setEditing((v) => !v)}>
                  {editing ? '完成编辑' : '✏️ 编辑资料'}
                </button>
                <button className="btn" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                  disabled={deleting} onClick={() => doDelete(activeName)}>
                  {deleting ? '删除中…' : '🗑 删除'}
                </button>
              </div>
            </div>

            <div className="drawer-body">
              {loading ? (
                <div className="loading"><div className="spinner" />加载中…</div>
              ) : (
                files.map((f) => {
                  const meta = DIM_META[f.filename] || { label: f.filename, icon: '📄' };
                  const dirty = editing && (drafts[f.filename] ?? '') !== f.content;
                  return (
                    <div key={f.filename} className="profile-dim">
                      <div className="profile-dim-head">
                        <div className="profile-dim-title">{meta.icon} {meta.label}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {f.filename === 'platforms.md' && (
                            <button className="btn btn-sm" disabled={fetchingWx}
                              title="用已登录的公众号后台会话抓取粉丝/内容数据，写入本栏（与数据中心同源）"
                              onClick={() => handleFetchWechat(f.filename)}>
                              {fetchingWx ? '抓取中…' : '📊 抓取公众号数据'}
                            </button>
                          )}
                          {editing && (
                            <button className="btn btn-sm btn-primary" disabled={!dirty || savingFile === f.filename}
                              onClick={() => handleSave(f.filename)}>
                              {savingFile === f.filename ? '保存中…' : dirty ? '保存' : '已保存'}
                            </button>
                          )}
                        </div>
                      </div>
                      {editing ? (
                        <textarea
                          className="field"
                          style={{ minHeight: 150, fontFamily: "'SF Mono','Consolas',monospace", fontSize: 13 }}
                          value={drafts[f.filename] ?? ''}
                          onChange={(e) => setDrafts((p) => ({ ...p, [f.filename]: e.target.value }))}
                        />
                      ) : (
                        <div className="card" style={{ padding: '14px 18px' }}>
                          <div className="profile-content"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(f.content || '_（空）_') }} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {kbOpen && (
        <div className="modal-overlay" onClick={() => { if (!kbBusy) setKbOpen(false); }}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">知识库挂载 · {activeName}</div>
            <div className="modal-hint">勾选要作为本画像知识库的内容；目录会包含全部子文件。挂载后 Agent 在该画像下对话时会优先读取这些内容。</div>
            {kbError && <div className="notice-error" style={{ marginTop: 8 }}>{kbError}</div>}
            <div style={{ maxHeight: '55vh', overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 10 }}>
              {kbLoading ? (
                <div className="loading" style={{ padding: '24px 0' }}><div className="spinner" />加载内容库…</div>
              ) : kbRoots.length ? (
                kbRoots.map((n) => renderKbNode(n, 0))
              ) : (
                <div className="modal-hint">内容库还没有可挂载的内容。</div>
              )}
            </div>
            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <span className="modal-hint">已选 {kbDraft.length} 项</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" onClick={() => setKbOpen(false)} disabled={kbBusy}>取消</button>
                <button className="btn btn-sm btn-primary" onClick={() => void saveKb()} disabled={kbBusy}>
                  {kbBusy ? '保存中…' : '保存挂载'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast ok"><span className="toast-icon">✓</span>{toast}</div>}
    </div>
  );
}
