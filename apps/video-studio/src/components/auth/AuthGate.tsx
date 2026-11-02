'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Loader2, LockKeyhole, UserPlus, X } from 'lucide-react';
import { useAppStore } from '@/store';
import { getCurrentUser, loginToScriptFlow, registerToScriptFlow, fetchUserSettings, mapServerSettingsToStore } from '@/lib/scriptflow';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const authStatus = useAppStore((s) => s.authStatus);
  const setAuthStatus = useAppStore((s) => s.setAuthStatus);
  const setAuthUser = useAppStore((s) => s.setAuthUser);
  const setToken = useAppStore((s) => s.setToken);
  const applyServerSettings = useAppStore((s) => s.applyServerSettings);
  const token = useAppStore((s) => s.token);
  const showLoginModal = useAppStore((s) => s.showLoginModal);
  const setShowLoginModal = useAppStore((s) => s.setShowLoginModal);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      getCurrentUser().then((user) => {
        if (user) {
          setAuthUser(user); setAuthStatus('authenticated');
          fetchUserSettings().then(settings => {
            applyServerSettings(mapServerSettingsToStore(settings) as Record<string, string>);
          }).catch(() => {});
        } else { setAuthStatus('guest'); setToken(''); }
      }).catch(() => { setAuthStatus('guest'); setToken(''); });
    } else {
      setAuthStatus('guest');
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const data = await (mode === 'login'
        ? loginToScriptFlow(String(form.get('username') || '').trim(), String(form.get('password') || ''))
        : registerToScriptFlow(String(form.get('username') || '').trim(), String(form.get('email') || '').trim(), String(form.get('password') || '')));
      const user = data.user || data;
      setAuthUser(user); setAuthStatus('authenticated');
      if ((data as any).token) setToken((data as any).token);
      try {
        const settings = await fetchUserSettings();
        applyServerSettings(mapServerSettingsToStore(settings) as Record<string, string>);
      } catch {}
      setShowLoginModal(false);
    } catch (e) { setError((e as Error).message); }
    setSubmitting(false);
  };

  const handleSkip = () => {
    setAuthUser({ id: 0, username: '离线用户' });
    setAuthStatus('authenticated');
    setShowLoginModal(false);
  };

  useEffect(() => {
    if (showLoginModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [showLoginModal]);

  return (
    <>
      {children}

      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[var(--app-text)]">{mode === 'login' ? '登录' : '注册'}</h2>
              <button onClick={() => setShowLoginModal(false)} className="text-gray-400 hover:text-[var(--app-text)]"><X className="w-4 h-4" /></button>
            </div>

            <div className="mb-4 flex rounded-lg bg-[var(--app-bg-alt)] p-1">
              <button type="button" onClick={() => setMode('login')} className={`flex-1 rounded-md py-1.5 text-sm font-medium ${mode === 'login' ? 'bg-[var(--app-primary)] text-white' : 'text-[var(--app-text-secondary)]'}`}>登录</button>
              <button type="button" onClick={() => setMode('register')} className={`flex-1 rounded-md py-1.5 text-sm font-medium ${mode === 'register' ? 'bg-[var(--app-primary)] text-white' : 'text-[var(--app-text-secondary)]'}`}>注册</button>
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <input name="username" required minLength={mode === 'register' ? 3 : undefined} placeholder="用户名或邮箱" className="h-9 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-sm outline-none focus:border-[var(--app-primary)]" />
              {mode === 'register' && <input name="email" type="email" required placeholder="邮箱" className="h-9 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-sm outline-none focus:border-[var(--app-primary)]" />}
              <input name="password" type="password" required minLength={mode === 'register' ? 6 : undefined} placeholder={mode === 'register' ? '至少6位密码' : '密码'} className="h-9 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-sm outline-none focus:border-[var(--app-primary)]" />
              {error && <div className="text-xs text-red-500">{error}</div>}
              <button type="submit" disabled={submitting} className="w-full h-9 rounded-lg bg-[var(--app-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'login' ? <><LockKeyhole className="w-4 h-4 mr-2" />登录</> : <><UserPlus className="w-4 h-4 mr-2" />注册</>}
              </button>
            </form>

            <button onClick={handleSkip} className="w-full mt-3 text-xs text-gray-400 hover:text-[var(--app-text-secondary)] py-2">
              跳过登录，离线使用
            </button>
          </div>
        </div>
      )}
    </>
  );
}
