import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';
import { fetchOutputs, fetchOutputContent, mediaUrl, deleteOutput, importOutputs, updateOutputMeta, getOutputReadme, saveOutputReadme, generateOutputReadme, getStoredUser } from '../lib/api';
import type { OutputNode, OutputMeta } from '../lib/api';
import { renderMarkdown } from '../lib/sanitize';
import { IconOutputs, IconImage, IconVideo, IconMusic, IconFile, IconFolder, IconRefresh, IconChevron, IconTrash, IconDownload } from './icons';

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
  { key: 'text', label: '文档' },
];

const KIND_LABEL: Record<string, string> = {
  article: '文章', 'xhs-note': '小红书', video: '视频', cards: '卡片',
  poster: '海报', audio: '音频', other: '其他',
};
const STATUS_LABEL: Record<string, string> = { draft: '草稿', ready: '待发', published: '已发' };
const STATUS_COLOR: Record<string, string> = { draft: '#94a3b8', ready: '#d97706', published: '#16a34a' };

const badge: CSSProperties = {
  fontSize: 11, padding: '1px 7px', borderRadius: 999,
  background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', whiteSpace: 'nowrap',
};
const statusBadge = (s: string): CSSProperties => ({
  ...badge, background: `${STATUS_COLOR[s] || '#94a3b8'}22`, color: STATUS_COLOR[s] || '#64748b',
});

interface ConfirmState {
  title: string;
  message: string;
  danger?: boolean;
  onOk: () => void | Promise<void>;
}

const readmeTemplate = (d: OutputNode) => `# ${d.title || d.name}

## 用途

## 文件说明

## 给 AI 的说明
`;

function kindIcon(kind: string | undefined, size = 30) {
  if (kind === 'video') return <IconVideo size={size} />;
  if (kind === 'audio') return <IconMusic size={size} />;
  if (kind === 'image') return <IconImage size={size} />;
  return <IconFile size={size} />;
}
const isHtml = (name: string) => /\.html?$/i.test(name);
const kindLabel = (f: OutputNode) =>
  f.kind === 'text' ? (isHtml(f.name) ? '卡片' : '文档')
    : f.kind === 'image' ? '图片' : f.kind === 'video' ? '视频' : f.kind === 'audio' ? '音频' : '文件';

/** 递归找目录下第一张图/视频作封面缩略图。 */
function firstMedia(node: OutputNode): OutputNode | null {
  if (node.type === 'file') return (node.kind === 'image' || node.kind === 'video') ? node : null;
  for (const c of node.children || []) {
    const m = firstMedia(c);
    if (m) return m;
  }
  return null;
}

/** 展示头声明的封面 → 伪 file 节点（供 Thumb 渲染）。 */
function coverNode(m?: OutputMeta): OutputNode | null {
  if (!m?.cover) return null;
  const kind = /\.(mp4|mov|webm|mkv)$/i.test(m.cover) ? 'video' : 'image';
  return { name: 'cover', type: 'file', path: m.cover, kind } as OutputNode;
}

/** 按名称路径解析到当前目录的 children（stackNames 稳定，刷新后仍有效）。 */
function resolvePath(roots: OutputNode[], names: string[]): OutputNode[] {
  let nodes = roots;
  for (const nm of names) {
    const found = nodes.find((n) => n.type === 'dir' && n.name === nm);
    if (!found) return nodes;   // 路径失效（被删/改）→ 停在能解析到的层
    nodes = found.children || [];
  }
  return nodes;
}

/** 删除当前目录/父目录或外部改动后，把失效的 stack 截断到仍存在的最深层。 */
function pruneStack(roots: OutputNode[], names: string[]): string[] {
  let nodes = roots;
  let depth = 0;
  for (const nm of names) {
    const found = nodes.find((n) => n.type === 'dir' && n.name === nm);
    if (!found) break;
    depth++;
    nodes = found.children || [];
  }
  return depth === names.length ? names : names.slice(0, depth);
}

function Thumb({ f, big }: { f: OutputNode | null; big?: boolean }) {
  if (f && f.kind === 'image') return <img src={mediaUrl(f.path)} alt="" loading="lazy" />;
  if (f && f.kind === 'video') return <video src={mediaUrl(f.path)} preload="metadata" muted />;
  return <div className="gcard-ph">{kindIcon(f?.kind, big ? 34 : 30)}</div>;
}

export default function OutputsPage() {
  const [roots, setRoots] = useState<OutputNode[]>([]);
  const me = getStoredUser();
  const [treeError, setTreeError] = useState('');
  const [stack, setStack] = useState<string[]>([]);   // 当前所在的文件夹名称路径
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<OutputNode | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [folderMenu, setFolderMenu] = useState(false);
  const [importMenu, setImportMenu] = useState(false);
  const [titleEdit, setTitleEdit] = useState<OutputNode | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [toast, setToast] = useState('');
  const [readmeEdit, setReadmeEdit] = useState<OutputNode | null>(null);
  const [readmeDraft, setReadmeDraft] = useState('');
  const [readmeLoading, setReadmeLoading] = useState(false);
  const [readmeSaving, setReadmeSaving] = useState(false);
  const [readmeGenerating, setReadmeGenerating] = useState(false);
  const [readmeError, setReadmeError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const reqSeq = useRef(0);

  const load = useCallback(() => {
    setTreeError('');
    fetchOutputs().then((next) => {
      setRoots(next);
      // 当前目录被删除/改名后，面包屑和分类栏不能继续停留在失效路径上。
      setStack((s) => pruneStack(next, s));
    }).catch(() => setTreeError('加载产物列表失败'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const currentNodes = useMemo(() => resolvePath(roots, stack), [roots, stack]);
  const currentDirNode = useMemo(() => {
    let nodes = roots;
    let node: OutputNode | null = null;
    for (const nm of stack) {
      node = nodes.find((n) => n.type === 'dir' && n.name === nm) || null;
      if (!node) return null;
      nodes = node.children || [];
    }
    return node;
  }, [roots, stack]);
  const currentReadonly = currentDirNode?.effectivePerm === 'ro';
  const dirs = useMemo(
    () => currentNodes.filter((n) => n.type === 'dir').sort((a, b) => (b.mtime || 0) - (a.mtime || 0)),
    [currentNodes]);
  const allFiles = useMemo(
    () => currentNodes.filter((n) => n.type === 'file').sort((a, b) => (b.mtime || 0) - (a.mtime || 0)),
    [currentNodes]);
  const files = useMemo(() => {
    return filter === 'all' ? allFiles : allFiles.filter((f) => f.kind === filter);
  }, [allFiles, filter]);

  const atTop = stack.length === 0;
  const atProjectRoot = stack.length === 1;
  // 当前项目的展示头（进入项目后才有），用于「成品/素材」分区
  const projectMeta = useMemo(
    () => (stack.length >= 1 ? roots.find((r) => r.name === stack[0])?.meta : undefined),
    [roots, stack]);
  const deliverableSet = useMemo(
    () => new Set(atProjectRoot ? (projectMeta?.deliverablePaths || []) : []),
    [projectMeta, atProjectRoot]);
  const hasSplit = atProjectRoot && deliverableSet.size > 0;
  const deliverableFiles = useMemo(
    () => (hasSplit ? files.filter((f) => deliverableSet.has(f.path)) : []),
    [files, deliverableSet, hasSplit]);
  const restFiles = useMemo(
    () => (hasSplit ? files.filter((f) => !deliverableSet.has(f.path)) : files),
    [files, deliverableSet, hasSplit]);

  const enterDir = useCallback((name: string) => { setStack((s) => [...s, name]); setFilter('all'); }, []);
  const goTo = useCallback((depth: number) => { setStack((s) => s.slice(0, depth)); setFilter('all'); }, []);

  const showToast = useCallback((m: string) => setToast(m), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!folderMenu) return;
    const close = () => setFolderMenu(false);
    const t = setTimeout(() => document.addEventListener('click', close), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', close); };
  }, [folderMenu]);
  useEffect(() => {
    if (!importMenu) return;
    const close = () => setImportMenu(false);
    const t = setTimeout(() => document.addEventListener('click', close), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', close); };
  }, [importMenu]);

  const remove = useCallback((node: OutputNode, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isDir = node.type === 'dir';
    const label = isDir ? `项目/文件夹「${node.title || node.name}」及其全部内容` : `文件「${node.name}」`;
    setConfirmState({
      title: '删除确认',
      message: `确定删除${label}？\n此操作不可恢复。`,
      danger: true,
      onOk: async () => {
        try {
          await deleteOutput(node.path);
          setSelected((cur) => (cur?.path === node.path ? null : cur));
          setFilter('all');
          load();
          showToast('已删除');
        } catch (err) {
          showToast((err as Error).message || '删除失败');
        }
      },
    });
  }, [load, showToast]);

  const doImport = useCallback(async (fs: File[], paths: string[], rootName: string) => {
    if (!fs.length) { showToast('没有可导入的文件'); return; }
    if (currentReadonly) { showToast('当前文件夹为只读，不能导入'); return; }
    setImporting(true);
    try {
      const res = await importOutputs(fs, stack.join('/'), paths, rootName);
      if (res.dir && stack.length === 0) setStack([res.dir]);
      load();
      const skipped = res.skipped || 0;
      showToast(skipped ? `导入完成，跳过 ${skipped} 个不支持的文件` : '导入完成');
    } catch (err) {
      showToast((err as Error).message || '导入失败');
    } finally {
      setImporting(false);
    }
  }, [stack, load, currentReadonly, showToast]);

  const importFiles = useCallback((list: FileList | null) => {
    const fs = list ? Array.from(list) : [];
    if (fileRef.current) fileRef.current.value = '';
    void doImport(fs, [], '');
  }, [doImport]);

  const importFolder = useCallback((list: FileList | null) => {
    const fs = list ? Array.from(list) : [];
    if (folderRef.current) folderRef.current.value = '';
    if (!fs.length) { showToast('文件夹为空，或没有可导入的文件'); return; }
    const paths = fs.map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
    const root = paths[0]?.split('/')[0] || '';
    void doImport(fs, paths, root);
  }, [doImport, showToast]);

  const openTitle = useCallback((d: OutputNode, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTitleEdit(d);
    setTitleDraft(d.title || d.meta?.title || d.name);
    setTitleError('');
  }, []);

  const saveTitle = useCallback(async () => {
    if (!titleEdit) return;
    setTitleSaving(true);
    setTitleError('');
    try {
      await updateOutputMeta(titleEdit.path, { title: titleDraft.trim() });
      setTitleEdit(null);
      load();
      showToast('标题已更新');
    } catch (err) {
      setTitleError((err as Error).message || '修改标题失败');
    } finally {
      setTitleSaving(false);
    }
  }, [titleEdit, titleDraft, load, showToast]);

  const applyPerm = useCallback(async (d: OutputNode, next: 'rw' | 'ro') => {
    try {
      await updateOutputMeta(d.path, { perm: next });
      load();
      showToast(next === 'ro' ? '已设为只读' : '已设为可写');
    } catch (err) {
      showToast((err as Error).message || '修改权限失败');
    }
  }, [load, showToast]);

  const togglePerm = useCallback((d: OutputNode, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (d.effectivePerm === 'ro' && d.perm !== 'ro') {
      showToast('该文件夹继承了上级的只读权限，请先解锁上级');
      return;
    }
    if (d.effectivePerm === 'ro') {
      void applyPerm(d, 'rw');
      return;
    }
    setConfirmState({
      title: '设为只读',
      message: `将「${d.title || d.name}」设为只读？\n只读会向下继承，且不能导入/删除/改标题。`,
      onOk: () => applyPerm(d, 'ro'),
    });
  }, [applyPerm, showToast]);

  const openReadme = useCallback(async (d: OutputNode, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReadmeEdit(d);
    setReadmeDraft('');
    setReadmeError('');
    setReadmeLoading(true);
    try {
      const r = await getOutputReadme(d.path);
      setReadmeDraft(r.content || readmeTemplate(d));
    } catch (err) {
      setReadmeError((err as Error).message || '读取说明失败');
    } finally {
      setReadmeLoading(false);
    }
  }, []);

  const saveReadme = useCallback(async () => {
    if (!readmeEdit) return;
    setReadmeSaving(true);
    setReadmeError('');
    try {
      await saveOutputReadme(readmeEdit.path, readmeDraft);
      setReadmeEdit(null);
      load();
      showToast('说明已保存');
    } catch (err) {
      setReadmeError((err as Error).message || '保存说明失败');
    } finally {
      setReadmeSaving(false);
    }
  }, [readmeEdit, readmeDraft, load, showToast]);

  const generateReadme = useCallback(async () => {
    if (!readmeEdit) return;
    setReadmeGenerating(true);
    setReadmeError('');
    try {
      const r = await generateOutputReadme(readmeEdit.path);
      const body = r.content.trim();
      const title = readmeEdit.title || readmeEdit.name;
      setReadmeDraft(body.startsWith('# ') ? body : `# ${title}\n\n${body}`);
      showToast('AI 已生成草稿，可修改后保存');
    } catch (err) {
      setReadmeError((err as Error).message || 'AI 生成失败');
    } finally {
      setReadmeGenerating(false);
    }
  }, [readmeEdit, showToast]);

  const open = useCallback(async (f: OutputNode) => {
    const seq = ++reqSeq.current;
    setSelected(f); setContent('');
    if (f.kind === 'text' && !isHtml(f.name)) {
      setLoading(true);
      try {
        const res = await fetchOutputContent(f.path);
        if (seq === reqSeq.current) setContent(res.isBinary ? '' : res.content);
      } finally { if (seq === reqSeq.current) setLoading(false); }
    }
  }, []);

  const preview = () => {
    if (!selected) return null;
    const url = mediaUrl(selected.path);
    if (selected.kind === 'image') return <img src={url} alt={selected.name} style={{ maxWidth: '100%', borderRadius: 'var(--radius)' }} />;
    if (selected.kind === 'video') return <video src={url} controls style={{ maxWidth: '100%', borderRadius: 'var(--radius)' }} />;
    if (selected.kind === 'audio') return <audio src={url} controls style={{ width: '100%' }} />;
    if (selected.kind === 'text' && isHtml(selected.name)) return (
      <>
        {/* allow-scripts：让预览页自带的「复制到公众号」按钮(execCommand('copy'))能运行；
            allow="clipboard-write"：授予剪贴板写权限。不给 allow-same-origin —— iframe 保持
            opaque origin，脚本跑得起来但访问不到本站，安全。(修复：内嵌预览里复制按钮点了没反应) */}
        <iframe src={`${url}?v=${selected.mtime ?? 0}`} title={selected.name} sandbox="allow-scripts" allow="clipboard-write"
          style={{ width: '100%', height: '68vh', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff' }} />
        <div style={{ marginTop: 8 }}><a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-start)', fontSize: 13 }}>在新标签打开 ↗</a></div>
      </>
    );
    if (selected.kind === 'text') {
      if (loading) return <div className="loading"><div className="spinner" />加载中…</div>;
      return <div className="outputs-viewer-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />;
    }
    return <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>无法预览。<a href={url} download style={{ color: 'var(--accent-start)' }}>下载 {selected.name}</a></div>;
  };

  /** 项目/文件夹卡片：顶层项目用展示头（标题/平台/状态/封面），嵌套子文件夹回退朴素样式。 */
  const renderDir = (d: OutputNode) => {
    const m = d.meta;
    const cover = coverNode(m) || firstMedia(d);
    const displayTitle = d.title || m?.title || d.name;
    return (
      <div key={d.path} className="card card-hover gcard" onClick={() => enterDir(d.name)}>
        <div className="gcard-thumb">
          <span className="gcard-kind">{m?.kind ? (KIND_LABEL[m.kind] || m.kind) : '文件夹'}</span>
          {cover ? <Thumb f={cover} big /> : <div className="gcard-ph"><IconFolder size={38} /></div>}
        </div>
        <div className="gcard-meta">
          <div className="gcard-name" title={displayTitle}>
            {!m && <IconFolder size={13} />} {displayTitle}
          </div>
          <div className="gcard-sub" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {d.effectivePerm === 'ro' && <span style={{ ...badge, background: '#fee2e2', color: '#b91c1c' }}>只读</span>}
            {m?.platform && <span style={badge}>{m.platform}</span>}
            {m?.status && <span style={statusBadge(m.status)}>{STATUS_LABEL[m.status] || m.status}</span>}
            <span>{d.fileCount ?? 0} 个文件</span>
          </div>
        </div>
      </div>
    );
  };

  const renderFile = (f: OutputNode) => (
    <div key={f.path} className="card card-hover gcard" onClick={() => open(f)}>
      <div className="gcard-thumb">
        <span className="gcard-kind">{kindLabel(f)}</span>
        <button className="gcard-del" title="删除" onClick={(e) => remove(f, e)}><IconTrash size={14} /></button>
        <Thumb f={f} />
      </div>
      <div className="gcard-meta">
        <div className="gcard-name" title={f.name}>{f.name}</div>
      </div>
    </div>
  );

  const empty = dirs.length === 0 && files.length === 0;

  const crumbLabel = (idx: number): string => {
    let nodes = roots;
    for (let i = 0; i <= idx; i++) {
      const n = nodes.find((x) => x.type === 'dir' && x.name === stack[i]);
      if (!n) return stack[idx];
      if (i === idx) return n.title || n.meta?.title || n.name;
      nodes = n.children || [];
    }
    return stack[idx];
  };

  return (
    <div className="gallery-page">
      <div className="gallery-head">
        <div>
          <h1 className="page-title">
            <IconOutputs size={21} />
            <span className="crumb" onClick={() => goTo(0)}>内容库</span>
            {stack.map((_name, i) => (
              <span key={i}>
                <span className="crumb-sep">/</span>
                {i === stack.length - 1
                  ? crumbLabel(i)
                  : <span className="crumb" onClick={() => goTo(i + 1)}>{crumbLabel(i)}</span>}
              </span>
            ))}
          </h1>
          <div className="page-subtitle" style={{ marginTop: 2 }}>
            当前账号：{me?.displayName || me?.username || '未登录'}
          </div>
          <p className="page-subtitle">
            {atTop
              ? `按项目归档，共 ${roots.length} 个项目。点项目进去看成品与素材。`
              : `${dirs.length} 个文件夹 · ${files.length} 个文件（可继续点开子文件夹）`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {stack.length > 0 && currentDirNode && (
            <div className="folder-menu-wrap">
              <button className="btn btn-sm" title="文件夹操作"
                onClick={(e) => { e.stopPropagation(); setFolderMenu((v) => !v); }}>⋯</button>
              {folderMenu && (
                <div className="folder-menu" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setFolderMenu(false); openTitle(currentDirNode); }} disabled={currentReadonly}>改标题</button>
                  <button onClick={() => { setFolderMenu(false); openReadme(currentDirNode); }} disabled={currentReadonly}>AI 写说明</button>
                  <button onClick={() => { setFolderMenu(false); togglePerm(currentDirNode); }}>
                    {currentReadonly ? '解锁（设为可写）' : '设为只读'}
                  </button>
                  <button className="danger" onClick={() => { setFolderMenu(false); remove(currentDirNode); }}>删除文件夹</button>
                </div>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" multiple hidden
            accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.mp4,.mov,.webm,.mkv,.mp3,.wav,.m4a,.pdf,.txt,.md,.markdown,.csv,.json,.srt,.vtt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.html,.htm"
            onChange={(e) => importFiles(e.target.files)} />
          <input
            ref={(el) => {
              folderRef.current = el;
              el?.setAttribute('webkitdirectory', '');
              el?.setAttribute('directory', '');
            }}
            type="file" multiple hidden
            onChange={(e) => importFolder(e.target.files)} />
          <div className="folder-menu-wrap">
            <button className="btn btn-sm" disabled={importing || currentReadonly}
              title={currentReadonly ? '当前文件夹为只读，不能导入' : '导入文件或整个文件夹'}
              onClick={(e) => { e.stopPropagation(); setImportMenu((v) => !v); }}>
              {importing ? '导入中…' : '导入'}
            </button>
            {importMenu && (
              <div className="folder-menu" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setImportMenu(false); fileRef.current?.click(); }}>导入文件</button>
                <button onClick={() => { setImportMenu(false); folderRef.current?.click(); }}>导入文件夹</button>
              </div>
            )}
          </div>
          <button className="btn btn-sm" onClick={load}><IconRefresh size={14} /> 刷新</button>
        </div>
      </div>

      {treeError && <div className="notice-error">{treeError}</div>}

      {/* 项目主题标签（进入项目根时展示） */}
      {atProjectRoot && projectMeta?.tags && projectMeta.tags.length > 0 && (
        <div className="gallery-filters" style={{ marginBottom: 4 }}>
          {projectMeta.tags.map((t) => <span key={t} style={badge}>#{t}</span>)}
        </div>
      )}

      {/* 面包屑返回 + 文件过滤（进入任意层后显示） */}
      {stack.length > 0 && (
        <div className="gallery-filters">
          <button className="btn btn-sm" onClick={() => goTo(stack.length - 1)}>
            <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><IconChevron size={13} /></span> 返回上级
          </button>
          {FILTERS.map((f) => (
            <button key={f.key} className={`chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
      )}

      {empty && !treeError ? (
        <div className="empty-state" style={{ height: 300 }}>
          <div className="empty-icon"><IconOutputs size={44} /></div>
          <p>{atTop ? '还没有产物——去对话或技能库生成第一条内容吧' : '这个文件夹是空的'}</p>
        </div>
      ) : hasSplit ? (
        <>
          {/* 成品区 */}
          {deliverableFiles.length > 0 && (
            <>
              <div className="section-label" style={{ margin: '6px 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                成品 · {deliverableFiles.length}
              </div>
              <div className="gallery-grid">{deliverableFiles.map(renderFile)}</div>
            </>
          )}
          {/* 素材 / 过程文件区 */}
          {(dirs.length > 0 || restFiles.length > 0) && (
            <>
              <div className="section-label" style={{ margin: '18px 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                素材 / 过程文件
              </div>
              <div className="gallery-grid">
                {dirs.map(renderDir)}
                {restFiles.map(renderFile)}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="gallery-grid">
          {dirs.map(renderDir)}
          {files.map(renderFile)}
        </div>
      )}

      {selected && (
        <div className="drawer-overlay" onClick={() => setSelected(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <div className="skill-detail-title" style={{ fontSize: 16 }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3, fontFamily: "'SF Mono','Consolas',monospace" }}>{selected.path}</div>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="drawer-body">{preview()}</div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <a className="btn btn-sm" href={mediaUrl(selected.path)} download={selected.name} style={{ textDecoration: 'none' }}>
                <IconDownload size={13} /> 下载
              </a>
              <button className="btn btn-sm btn-danger" onClick={(e) => remove(selected, e)}><IconTrash size={13} /> 删除此文件</button>
            </div>
          </div>
        </div>
      )}

      {titleEdit && (
        <div className="modal-overlay" onClick={() => { if (!titleSaving) setTitleEdit(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">编辑文件夹标题</div>
            <input className="modal-input" autoFocus value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveTitle();
                if (e.key === 'Escape' && !titleSaving) setTitleEdit(null);
              }}
              placeholder="留空恢复文件夹名" />
            <div className="modal-hint">显示在卡片和面包屑；不会改物理文件夹名</div>
            {titleError && <div className="notice-error" style={{ marginTop: 8 }}>{titleError}</div>}
            <div className="modal-actions">
              <button className="btn btn-sm" onClick={() => setTitleEdit(null)} disabled={titleSaving}>取消</button>
              <button className="btn btn-sm btn-primary" onClick={() => void saveTitle()} disabled={titleSaving}>
                {titleSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {readmeEdit && (
        <div className="modal-overlay" onClick={() => { if (!readmeSaving) setReadmeEdit(null); }}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">文件夹说明</div>
            <div className="modal-hint">保存为 {readmeEdit.path}/README.md；点「AI 生成」会根据文件夹内容起稿，可修改后保存</div>
            {readmeLoading ? (
              <div className="loading" style={{ padding: '36px 0' }}><div className="spinner" />加载中…</div>
            ) : (
              <textarea className="modal-textarea" autoFocus value={readmeDraft}
                onChange={(e) => setReadmeDraft(e.target.value)}
                placeholder="写清楚这个文件夹的用途、文件结构和给 AI 的指令…" />
            )}
            {readmeGenerating && <div className="modal-hint">AI 正在逐张读取文件夹内容，图片多时可能需要几分钟…</div>}
            {readmeError && <div className="notice-error" style={{ marginTop: 8 }}>{readmeError}</div>}
            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <button className="btn btn-sm" onClick={() => void generateReadme()}
                disabled={readmeSaving || readmeLoading || readmeGenerating}>
                {readmeGenerating ? 'AI 生成中…' : 'AI 生成'}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" onClick={() => setReadmeEdit(null)}
                  disabled={readmeSaving || readmeGenerating}>取消</button>
                <button className="btn btn-sm btn-primary" onClick={() => void saveReadme()}
                  disabled={readmeSaving || readmeLoading || readmeGenerating}>
                  {readmeSaving ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmState && (
        <div className="modal-overlay" onClick={() => setConfirmState(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{confirmState.title}</div>
            <div className="modal-message">{confirmState.message}</div>
            <div className="modal-actions">
              <button className="btn btn-sm" onClick={() => setConfirmState(null)}>取消</button>
              <button className={`btn btn-sm ${confirmState.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => { const fn = confirmState.onOk; setConfirmState(null); void fn(); }}>
                {confirmState.danger ? '删除' : '确定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="outputs-toast">{toast}</div>}
    </div>
  );
}
