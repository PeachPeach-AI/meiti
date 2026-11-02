import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AuthGate from './components/AuthGate.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { getToken, setToken } from './lib/api'

/* 工具模式（工作站）切换到某账号时，通过 iframe URL 注入 token。 */
try {
  const q = new URLSearchParams(window.location.search).get('token')
  if (q) {
    setToken(q)
    const url = new URL(window.location.href)
    url.searchParams.delete('token')
    window.history.replaceState(null, '', url.toString())
  } else {
    // 已有本地 token 时补写 Cookie，保证 <img>/media 请求也带鉴权
    const t = getToken()
    if (t) setToken(t)
  }
} catch { /* ignore */ }

/* 飞书/多维表格等外链交给系统浏览器，复用浏览器里已登录的飞书会话。 */
function openExternalLink(url: string) {
  const bridge = (window as unknown as { desktopWindow?: { openExternal?: (u: string) => void } }).desktopWindow;
  if (bridge?.openExternal) { bridge.openExternal(url); return; }
  window.open(url, '_blank', 'noopener,noreferrer');
}

document.addEventListener('click', (e) => {
  const el = e.target as HTMLElement | null;
  const a = el?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a) return;
  const href = a.getAttribute('href') || '';
  if (!/^https?:\/\//i.test(href)) return;
  try {
    if (new URL(href).origin === window.location.origin) return;
  } catch { return; }
  e.preventDefault();
  e.stopPropagation();
  openExternalLink(href);
}, true);

export const BUILD_ID = 'subnav-1';
// 打到控制台，便于确认浏览器加载的是最新前端（排查缓存旧包）
console.log(`%cEasel build: ${BUILD_ID}`, 'color:#8b5cf6;font-weight:bold');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthGate>
        <App />
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>,
)
