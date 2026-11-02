import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import {
  authLogin, authRegister, authMe, getToken, setToken, setStoredUser, getStoredUser,
  getSavedAccounts, type AuthUser,
} from '../lib/api';

export default function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved] = useState(() => getSavedAccounts());

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    authMe()
      .then((u) => { setUser(u); setStoredUser(u); })
      .catch(() => { setToken(''); setStoredUser(null); setUser(null); })
      .finally(() => setReady(true));
  }, []);

  // 登录后把 token/用户同步给工具模式（工作站左栏账号按钮）
  useEffect(() => {
    const token = getToken();
    if (!user || !token) return;
    try { window.parent?.postMessage({ type: 'easel-auth', token, user }, '*'); } catch { /* ignore */ }
  }, [user]);

  if (!ready) {
    return <div className="loading" style={{ height: '100vh' }}><div className="spinner" />加载中…</div>;
  }
  if (user) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      if (mode === 'register') await authRegister(username.trim(), password, displayName.trim());
      else await authLogin(username.trim(), password);
      window.location.reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (acc: { user: AuthUser; token: string }) => {
    setToken(acc.token); setStoredUser(acc.user); window.location.reload();
  };

  const inputStyle: CSSProperties = { width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div className="card" style={{ width: 400, maxWidth: '100%', padding: 28 }}>
        <p className="page-subtitle" style={{ marginTop: 0 }}>本地账号 · 每个账号的画像、内容、账号信息相互独立</p>

        <form onSubmit={submit} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'register' && (
            <input className="field" style={inputStyle} placeholder="显示名称（可选）"
              value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          )}
          <input className="field" style={inputStyle} placeholder="用户名" autoComplete="username"
            value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input className="field" style={inputStyle} type="password" placeholder="密码" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password} onChange={(e) => setPassword(e.target.value)} required />
          {err && <div style={{ color: 'var(--red)', fontSize: 12 }}>{err}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并进入'}
          </button>
        </form>

        <button className="btn btn-ghost" style={{ marginTop: 10, width: '100%' }}
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
          {mode === 'login' ? '没有账号？注册' : '已有账号？登录'}
        </button>

        <button className="btn btn-ghost" style={{ marginTop: 8, width: '100%' }}
          onClick={() => {
            const url = 'https://my.feishu.cn/';
            const bridge = (window as unknown as { desktopWindow?: { openExternal?: (u: string) => void } }).desktopWindow;
            if (bridge?.openExternal) bridge.openExternal(url);
            else window.open(url, '_blank', 'noopener,noreferrer');
          }}>
          飞书登录 / 打开飞书
        </button>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          在浏览器登录一次飞书后，点多维表格链接会复用这个登录态，不再重复登录。
        </div>

        {saved.length > 0 && (
          <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>快速切换</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {saved.map((acc) => (
                <button key={acc.user.id} className="btn btn-sm" style={{ justifyContent: 'flex-start' }}
                  onClick={() => switchTo(acc)}>
                  {acc.user.displayName || acc.user.username}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>{acc.user.username}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
