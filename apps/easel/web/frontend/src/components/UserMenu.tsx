import { useState } from 'react';
import {
  getStoredUser, getSavedAccounts, setToken, setStoredUser, removeSavedAccount, authLogout,
} from '../lib/api';

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [me] = useState(() => getStoredUser());
  const [saved, setSaved] = useState(() => getSavedAccounts());
  if (!me) return null;

  const switchTo = (acc: { user: { id: string; displayName?: string; username: string }; token: string }) => {
    setToken(acc.token); setStoredUser(acc.user as never); window.location.reload();
  };
  const logout = async () => { await authLogout(); window.location.reload(); };
  const remove = (id: string) => {
    removeSavedAccount(id);
    setSaved(getSavedAccounts());
    if (id === me.id) { void logout(); }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button className="settings-gear" onClick={() => setOpen((v) => !v)} title="账号 / 切换">
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, borderRadius: 6, background: 'var(--accent-start)', color: '#fff',
          fontSize: 10, fontWeight: 700, marginRight: 4,
        }}>{(me.displayName || me.username || '?').slice(0, 1)}</span>
        {me.displayName || me.username}
      </button>
      {open && (
        <div className="card" style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 6px)', width: 240, padding: 8, zIndex: 50 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 6px' }}>已登录账号</div>
          {saved.map((acc) => (
            <div key={acc.user.id} style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <button className="btn btn-sm" style={{ flex: 1, justifyContent: 'flex-start' }}
                onClick={() => switchTo(acc as never)}>
                {acc.user.displayName || acc.user.username}
                {acc.user.id === me.id && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)' }}>当前</span>}
              </button>
              <button className="btn btn-sm btn-ghost" title="移除该账号" onClick={() => remove(acc.user.id)}>✕</button>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
            <button className="btn btn-sm" style={{ width: '100%' }} onClick={logout}>退出登录</button>
          </div>
        </div>
      )}
    </div>
  );
}
