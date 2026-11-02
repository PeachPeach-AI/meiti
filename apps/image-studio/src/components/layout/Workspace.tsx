'use client'

import React, { useState } from 'react'
import { useAppStore } from '@/store'
import { useResizer } from '@/hooks/useResizer'
import { useIsMobile } from '@/hooks/useIsMobile'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { CreatorPanel } from '@/components/creator/CreatorPanel'
import { ResultsPanel } from '@/components/results/ResultsPanel'
import { Settings, Image, Clock } from 'lucide-react'

const MOBILE_TABS = [
  { key: 'settings', label: '设置', icon: Settings },
  { key: 'creator', label: '创作', icon: Image },
  { key: 'results', label: '历史', icon: Clock },
] as const

type MobileTab = typeof MOBILE_TABS[number]['key']

export function Workspace() {
  const isMobile = useIsMobile()
  const leftWidth = useAppStore((s) => s.leftPanelWidth)
  const rightWidth = useAppStore((s) => s.rightPanelWidth)
  const leftResizer = useResizer('left')
  const rightResizer = useResizer('right')
  const [mobileTab, setMobileTab] = useState<MobileTab>('creator')

  if (isMobile) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Active panel */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {mobileTab === 'settings' && <SettingsPanel />}
          {mobileTab === 'creator' && <CreatorPanel />}
          {mobileTab === 'results' && <ResultsPanel />}
        </div>

        {/* Bottom tab bar */}
        <div className="flex shrink-0 border-t border-app-border bg-app-bg">
          {MOBILE_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMobileTab(key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                mobileTab === key
                  ? 'text-blue-600'
                  : 'text-app-text-muted'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Left Panel */}
      <div className="shrink-0 overflow-hidden border-r border-app-border" style={{ width: leftWidth }}>
        <SettingsPanel />
      </div>

      {/* Left Resizer */}
      <div
        className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors relative group"
        onMouseDown={leftResizer.onMouseDown}
        onDoubleClick={leftResizer.onDoubleClick}
        title="拖拽调整设置区宽度，双击恢复默认"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* Center Panel */}
      <CreatorPanel />

      {/* Right Resizer */}
      <div
        className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors relative group"
        onMouseDown={rightResizer.onMouseDown}
        onDoubleClick={rightResizer.onDoubleClick}
        title="拖拽调整历史区宽度，双击恢复默认"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* Right Panel */}
      <div className="shrink-0 overflow-hidden border-l border-app-border" style={{ width: rightWidth }}>
        <ResultsPanel />
      </div>
    </div>
  )
}
