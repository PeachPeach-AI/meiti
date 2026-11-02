import { useEffect, useMemo, useRef, useState } from 'react';
import { CAPABILITY_MENU } from '../lib/capabilityMenu';
import type { CapabilityItem } from '../lib/capabilityMenu';

const DOT: Record<string, string> = { done: 's-done', ready: 's-ready', need: 's-need', incoming: 's-incoming' };

/** 笔入口：点开「能做的都在这」→ 选一项自动填进输入框。纯前端，选中即预填，不自动发送。 */
export default function BrushEntry({ onPick }: { onPick: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const all = useMemo(
    () => CAPABILITY_MENU.tabs.flatMap((t) => t.groups.flatMap((g) => g.items)),
    [],
  );
  const pipeline = useMemo(() => all.find((x) => x.status === 'incoming'), [all]);

  const ql = q.trim().toLowerCase();
  const hit = (it: CapabilityItem) => !ql || `${it.label}${it.desc || ''}${it.skill || ''}`.toLowerCase().includes(ql);

  const pick = (it: CapabilityItem, pipe?: boolean) => {
    onPick(pipe ? '用「视频产线」做一支整片：' : `帮我做「${it.label}」`);
    setOpen(false);
  };

  return (
    <div className={`brush-entry${open ? ' open' : ''}`} ref={wrapRef}>
      <button type="button" className="brush-btn" onClick={() => setOpen((v) => !v)}
        aria-label="看看能做什么" title="看看能做什么">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3.5l1.55 4.45L18 9.5l-4.45 1.55L12 15.5l-1.55-4.45L6 9.5l4.45-1.55L12 3.5Z" />
          <path d="M18.5 14.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z" />
        </svg>
        <span className="brush-mark" aria-hidden="true" />
        <span className="brush-tip">看看能做什么</span>
      </button>

      {open && (
        <div className="brush-panel" role="dialog" aria-label="能做的都在这">
          <div className="brush-panel-head">
            <div className="brush-panel-headline">
              <div className="brush-panel-title">能做的都在这</div>
              <div className="brush-panel-sub">选一个 → 自动填进输入框；「管线」件走整片产线</div>
            </div>
            <input ref={searchRef} className="brush-search" placeholder="搜索…" value={q}
              onChange={(e) => setQ(e.target.value)} />
            <button type="button" className="brush-close" onClick={() => setOpen(false)} aria-label="关闭">×</button>
          </div>
          <div className="brush-tabs">
            {CAPABILITY_MENU.tabs.map((t, i) => (
              <button type="button" key={t.id} className={`brush-tab${i === tab ? ' on' : ''}`}
                onClick={() => setTab(i)}>{t.label}</button>
            ))}
          </div>
          <div className="brush-body">
            {pipeline && hit(pipeline) && (
              <div className="brush-grp">
                <div className="brush-grp-name">整片级 · 走独立管线</div>
                <button type="button" className="brush-item brush-item-pipe" onClick={() => pick(pipeline, true)}>
                  <span className={`brush-dot ${DOT[pipeline.status || 'ready'] || 's-ready'}`} />
                  <span className="brush-il">{pipeline.label}</span>
                  <span className="brush-chip-pipe">管线</span>
                  <span className="brush-idesc">{pipeline.desc}</span>
                  <span className="brush-iadd">＋</span>
                </button>
              </div>
            )}
            {CAPABILITY_MENU.tabs[tab] && CAPABILITY_MENU.tabs[tab].groups.map((g) => {
              const items = g.items.filter((it) => it.status !== 'incoming' && hit(it));
              if (!items.length) return null;
              return (
                <div key={g.label} className="brush-grp">
                  <div className="brush-grp-name">{g.label} · {items.length}</div>
                  {items.map((it) => (
                    <button type="button" key={it.skill || it.label} className="brush-item" onClick={() => pick(it)}>
                      <span className={`brush-dot ${DOT[it.status || 'ready'] || 's-ready'}`} />
                      <span className="brush-il">{it.label}</span>
                      <span className="brush-idesc">{it.desc}</span>
                      <span className="brush-iadd">＋</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
