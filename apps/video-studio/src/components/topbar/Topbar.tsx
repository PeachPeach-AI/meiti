import { Moon, Sun, WandSparkles, RefreshCw, Puzzle, LogOut, Save, User } from 'lucide-react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/Button';
import { PRODUCTION_STAGES } from '@/types';
import { collectServerSettings, saveUserSettings } from '@/lib/scriptflow';
import { useState } from 'react';

export function Topbar() {
  const { theme, toggleTheme, videoApiKey, imageApiKey, textApiKey, projectTitle, setProjectTitle, productionStage, shots, user, logout, token, setShowLoginModal } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const hasKey = !!(videoApiKey || imageApiKey || textApiKey);
  const stage = PRODUCTION_STAGES.find((item) => item.key === productionStage) ?? PRODUCTION_STAGES[0];
  const approved = shots.filter((shot) => ['approved', 'endframe_locked', 'archived'].includes(shot.status)).length;
  const review = shots.filter((shot) => shot.status === 'review').length;
  const failed = shots.filter((shot) => ['needs_repair', 'repairing'].includes(shot.status)).length;

  return (
    <header className="h-14 border-b border-[var(--app-border)] bg-[var(--app-bg)] flex items-center justify-between gap-3 px-4 shrink-0 z-20">
      <div className="flex min-w-0 items-center gap-3">
        <WandSparkles className="w-5 h-5 shrink-0 text-[var(--app-primary)]" />
        <div className="min-w-0">
          <input value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} className="block w-52 max-w-[34vw] truncate border-0 bg-transparent p-0 text-sm font-bold text-[var(--app-text)] outline-none" aria-label="项目名称" />
          <div className="flex items-center gap-2 text-[10px] text-[var(--app-text-secondary)]">
            <span>{stage.no} {stage.label}</span>
            <span>{shots.length} 镜头</span>
            <span>{approved} 通过</span>
            <span className="text-amber-500">{review} 待验收</span>
            <span className="text-red-500">{failed} 需修复</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs ${hasKey ? 'text-green-500' : 'text-gray-400'}`}>
          {hasKey ? '已配置' : '未配置 Key'}
        </span>
        <Button variant="ghost" size="sm" onClick={() => window.location.reload()} title="刷新">
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {user ? (
          <div className="relative" onMouseLeave={() => setMenuOpen(false)}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 rounded-full bg-[var(--app-primary)] text-white text-sm font-bold flex items-center justify-center hover:opacity-90 transition-opacity">
              {user.username.charAt(0).toUpperCase()}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--app-card-bg)] border border-[var(--app-border)] rounded-lg shadow-lg py-1 z-50">
                <div className="px-3 py-2 text-xs text-[var(--app-text)] border-b border-[var(--app-border-light)] font-medium">{user.username}</div>
                {user.id !== 0 && (
                  <button onClick={async () => {
                    const settings = collectServerSettings(useAppStore.getState());
                    try { await saveUserSettings(settings, token); } catch {}
                    setMenuOpen(false);
                  }} className="w-full text-left px-3 py-2 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)] flex items-center gap-2">
                    <Save className="w-3 h-3" /> 同步到服务器
                  </button>
                )}
                <button onClick={() => { logout(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-[var(--app-hover)] flex items-center gap-2">
                  <LogOut className="w-3 h-3" /> 退出登录
                </button>
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => setShowLoginModal(true)} className="h-8 px-3 text-xs font-medium rounded-lg bg-[var(--app-primary)] text-white hover:opacity-90 transition-opacity">
            登录
          </button>
        )}
      </div>
    </header>
  );
}
