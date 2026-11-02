'use client';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useResizer } from '@/hooks/useResizer';
import { useAppStore } from '@/store';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { CreatorPanel } from '@/components/creator/CreatorPanel';
import { ResultsPanel } from '@/components/results/ResultsPanel';
import { useState } from 'react';

const MOBILE_STEPS = [
  { key: 'settings', label: '1 配置' },
  { key: 'creator', label: '2 创作' },
  { key: 'results', label: '3 历史' },
] as const;

export function Workspace() {
  const isMobile = useIsMobile();
  const leftWidth = useAppStore((s) => s.leftPanelWidth);
  const rightWidth = useAppStore((s) => s.rightPanelWidth);
  const leftResizer = useResizer('left');
  const rightResizer = useResizer('right');
  const [mobileTab, setMobileTab] = useState<'settings' | 'creator' | 'results'>('creator');

  if (isMobile) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="border-b border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-2">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--app-bg-alt)] p-0.5">
            {MOBILE_STEPS.map((t) => (
              <button key={t.key} onClick={() => setMobileTab(t.key)} className={`rounded-md py-1.5 text-xs font-medium ${mobileTab === t.key ? 'bg-[var(--app-primary)] text-white' : 'text-gray-500'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {mobileTab === 'settings' && <SettingsPanel />}
          {mobileTab === 'creator' && <CreatorPanel />}
          {mobileTab === 'results' && <ResultsPanel />}
        </div>
        <div className="h-12 border-t border-[var(--app-border)] bg-[var(--app-bg)] grid grid-cols-3 shrink-0">
          {MOBILE_STEPS.map((t) => (
            <button key={t.key} onClick={() => setMobileTab(t.key)} className={`text-xs ${mobileTab === t.key ? 'text-[var(--app-primary)] font-bold' : 'text-gray-500'}`}>
              {t.label.replace(/^\d\s/, '')}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0">
      <div style={{ width: leftWidth }} className="shrink-0 border-r border-[var(--app-border)] bg-[var(--app-bg)]">
        <SettingsPanel />
      </div>
      <div className="w-1 cursor-col-resize bg-[var(--app-border)] hover:bg-[var(--app-primary)] transition-colors shrink-0" onMouseDown={leftResizer.onMouseDown} onDoubleClick={leftResizer.onDoubleClick} />
      <div className="flex-1 min-w-0 bg-[var(--app-bg)]">
        <CreatorPanel />
      </div>
      <div className="w-1 cursor-col-resize bg-[var(--app-border)] hover:bg-[var(--app-primary)] transition-colors shrink-0" onMouseDown={rightResizer.onMouseDown} onDoubleClick={rightResizer.onDoubleClick} />
      <div style={{ width: rightWidth }} className="shrink-0 border-l border-[var(--app-border)] bg-[var(--app-bg)]">
        <ResultsPanel />
      </div>
    </div>
  );
}