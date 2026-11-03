import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchAccounts, startLogin, loginStatus, mediaUrl,
  accountWhoami, logoutAccount, submitLoginSms,
  repairAccount,
  saveCredentials, getCredentials, startMpLogin, mpLoginStatus,
  getCmsCredentials, saveCmsCredentials,
  fetchFeishuStatus, startFeishuLogin, logoutFeishu,
} from '../lib/api';
import type { AccountItem, AccountWhoami, FeishuStatus } from '../lib/api';
import { getWhoamiCache, setWhoamiCache, verifyStale } from '../lib/whoami';
import { IconAccounts } from './icons';

type QRState = {
  platform: string;
  name: string;
  state: string;       // starting | qr_ready | success | expired | error | unknown
  message: string;
  qr: string;          // outputs 相对路径
  qrTs?: number;       // 二维码文件 mtime，作 img 缓存键：码刷新一次就变，避免看到过期旧码
};

// 有持久化 profile、可做「重置」的平台（与 account_repair.py 的 PROFILES 对齐）
const REPAIRABLE = new Set([
  'douyin', 'xiaohongshu', 'kuaishou', 'weixin-channels',
  'zhihu', 'weibo', 'toutiao', 'baijiahao', 'sohu',
]);

const STATE_LABEL: Record<string, string> = {
  starting: '启动中…',
  qr_ready: '请扫码',
  scanned: '扫码成功',
  sms_required: '需短信验证',
  verifying: '验证中…',
  success: '登录成功 ✅',
  expired: '二维码已过期',
  error: '登录出错',
  unknown: '等待中…',
};

/** 头像：有 URL 就显示图（加载失败退回首字），否则显示昵称/平台名首字。 */
function Avatar({ url, name }: { url?: string; name: string }) {
  const [broken, setBroken] = useState(false);
  const initial = (name || '?').trim().charAt(0);
  if (url && !broken) {
    return <img className="account-avatar" src={url} alt={name}
      referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <div className="account-avatar account-avatar-fallback">{initial}</div>;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [err, setErr] = useState('');
  const [qr, setQr] = useState<QRState | null>(null);
  const [qrNonce, setQrNonce] = useState(0);   // 每次登录 +1，稳定缓存 key，避免每次轮询 img 闪烁
  const [terminalMsg, setTerminalMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [logoutBusy, setLogoutBusy] = useState('');
  const [repairBusy, setRepairBusy] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsBusy, setSmsBusy] = useState(false);
  const [smsErr, setSmsErr] = useState('');
  // whoami 结果缓存到 localStorage：打开页面秒显示昵称/头像，不必每次都起浏览器校验
  const [whoami, setWhoami] = useState<Record<string, AccountWhoami | 'loading'>>(() => getWhoamiCache());
  // 凭证式登录（微信公众号 AppID/AppSecret；自建站 站点/账号/密码）
  const [cred, setCred] = useState<AccountItem | null>(null);
  const [credForm, setCredForm] = useState({ appId: '', appSecret: '', author: '' });
  const [cmsForm, setCmsForm] = useState({ siteUrl: '', username: '', secret: '', name: '' });
  const [credBusy, setCredBusy] = useState(false);
  const [credMsg, setCredMsg] = useState('');
  const [credErr, setCredErr] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aliveRef = useRef(true);
  const qrPlatformRef = useRef('');   // 当前登录中的平台，供 submitSms 稳定引用
  const [feishuStatus, setFeishuStatus] = useState<FeishuStatus | null>(null);
  const [feishuBusy, setFeishuBusy] = useState(false);
  const [feishuMsg, setFeishuMsg] = useState('');
  const feishuPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // 真校验某平台登录态 + 拉昵称/头像（后端起浏览器，数秒）；手动「校验账号」或登录成功后调
  const runWhoami = useCallback((platform: string) => {
    setWhoami((w) => ({ ...w, [platform]: 'loading' }));
    accountWhoami(platform)
      .then((r) => { if (aliveRef.current) { setWhoami((w) => ({ ...w, [platform]: r })); setWhoamiCache(platform, r); } })
      .catch(() => {
        if (aliveRef.current) setWhoami((w) => { const n = { ...w }; delete n[platform]; return n; });
      });
  }, []);

  // 打开页面：拉「快」状态（读 status.json，不起浏览器），随后后台自愈——对缓存缺失/过期的
  // 浏览器平台逐个真校验（whoami），结果到了刷新 UI，并令陈旧的假阴性缓存被真值覆盖。
  const load = useCallback(() => {
    setErr('');
    fetchAccounts()
      .then((list) => {
        if (!aliveRef.current) return;
        setAccounts(list);
        const targets = list
          .filter((a) => a.supported && a.backend !== 'biliup')
          .map((a) => a.platform);
        verifyStale(targets, {
          alive: () => aliveRef.current,
          onUpdate: (platform, r) => setWhoami((w) => ({ ...w, [platform]: r })),
        });
      })
      .catch(() => setErr('加载账号状态失败'));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetchFeishuStatus().then(setFeishuStatus).catch(() => {});
    return () => {
      if (feishuPollRef.current) { clearInterval(feishuPollRef.current); feishuPollRef.current = null; }
    };
  }, []);

  // 切回本标签页 / 窗口重新获得焦点时自动重拉账号态——登录/退出后即使漏了一次刷新，切回来也是最新的，
  // 用户无需手动刷新页面。（登录中弹着二维码时不打扰，避免打断轮询。）
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && !pollRef.current) load(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const closeQr = useCallback(() => {
    stopPoll();
    setQr(null);
    setSmsCode(''); setSmsErr(''); setSmsBusy(false);
    load();
  }, [stopPoll, load]);

  const submitSms = useCallback(async () => {
    const code = smsCode.replace(/\D/g, '');
    if (code.length < 4) { setSmsErr('请输入手机收到的验证码'); return; }
    setSmsBusy(true); setSmsErr('');
    try {
      await submitLoginSms(qrPlatformRef.current, code);
      setSmsCode('');
      // 乐观切到「验证中」转圈：后端读走码→verifying；成功→success，失败→退回 sms_required 带错误
      setQr((prev) => prev && ({ ...prev, state: 'verifying', message: '正在验证验证码…' }));
      // 不停轮询：runner 读走验证码填码提交后，state 会转 success / 或退回 sms_required 重试
    } catch (e) {
      setSmsErr(e instanceof Error ? e.message : '提交验证码失败');
    } finally {
      setSmsBusy(false);
    }
  }, [smsCode]);

  // 凭证式（公众号）：打开 AppID/AppSecret 表单
  const openCred = useCallback((a: AccountItem) => {
    setCred(a);
    setCredForm({ appId: '', appSecret: '', author: '' });
    setCmsForm({ siteUrl: '', username: '', secret: '', name: '' });
    setCredMsg(''); setCredErr('');
    if (a.backend === 'cms') {
      getCmsCredentials(a.platform)
        .then((c) => {
          if (!aliveRef.current || !c.configured) return;
          setCmsForm({ siteUrl: c.siteUrl || '', username: c.username || '', secret: '', name: c.name || '' });
          setCredMsg(`已配置：${c.siteUrl}`);
        })
        .catch(() => { /* 未配置，忽略 */ });
      return;
    }
    getCredentials(a.platform)
      .then((c) => { if (aliveRef.current && c.configured) setCredMsg(`已配置：AppID ${c.appIdMasked}`); })
      .catch(() => { /* 未配置，忽略 */ });
  }, []);

  const closeCred = useCallback(() => { setCred(null); setCredBusy(false); load(); }, [load]);

  const submitCred = useCallback(async () => {
    if (!cred) return;
    setCredBusy(true); setCredErr(''); setCredMsg('');
    try {
      if (cred.backend === 'cms') {
        const siteUrl = cmsForm.siteUrl.trim();
        const username = cmsForm.username.trim();
        const secret = cmsForm.secret.trim();
        if (!siteUrl || !username || !secret) { setCredErr('站点地址、用户名、密码都要填'); return; }
        const r = await saveCmsCredentials(cred.platform, { siteUrl, username, secret, name: cmsForm.name.trim() });
        if (r.ok) { runWhoami(cred.platform); closeCred(); }
        else setCredErr(r.message || '验证未通过');
        return;
      }
      const appId = credForm.appId.trim();
      const appSecret = credForm.appSecret.trim();
      if (!appId || !appSecret) { setCredErr('AppID 和 AppSecret 都要填'); return; }
      const r = await saveCredentials(cred.platform, { appId, appSecret, name: cred.name, author: credForm.author.trim() });
      if (r.ok) {
        runWhoami(cred.platform);
        closeCred();
      } else {
        setCredErr(r.message || '验证未通过');
      }
    } catch (e) {
      setCredErr(e instanceof Error ? e.message : '保存失败');
    } finally {
      setCredBusy(false);
    }
  }, [cred, credForm, cmsForm, runWhoami, closeCred]);

  const openFeishuLogin = useCallback(async () => {
    if (feishuPollRef.current) { clearInterval(feishuPollRef.current); feishuPollRef.current = null; }
    setFeishuBusy(true);
    setFeishuMsg('');
    try {
      const r = await startFeishuLogin();
      const bridge = (window as unknown as { desktopWindow?: { openExternal?: (u: string) => void } }).desktopWindow;
      if (bridge?.openExternal) bridge.openExternal(r.url);
      else window.open(r.url, '_blank', 'noopener,noreferrer');
      setFeishuMsg('等待浏览器完成飞书授权…');
      const started = Date.now();
      feishuPollRef.current = setInterval(() => {
        fetchFeishuStatus()
          .then((s) => {
            if (s.logged_in) {
              setFeishuStatus(s);
              setFeishuMsg('');
              if (feishuPollRef.current) { clearInterval(feishuPollRef.current); feishuPollRef.current = null; }
            }
          })
          .catch(() => { /* 继续轮询 */ });
        if (Date.now() - started > 120000 && feishuPollRef.current) {
          clearInterval(feishuPollRef.current);
          feishuPollRef.current = null;
          setFeishuMsg('飞书授权超时，请重试');
        }
      }, 2000);
    } catch (e) {
      setFeishuMsg(e instanceof Error ? e.message : '发起飞书登录失败');
    } finally {
      setFeishuBusy(false);
    }
  }, []);

  const handleFeishuLogout = useCallback(async () => {
    setFeishuBusy(true);
    setFeishuMsg('');
    try {
      await logoutFeishu();
      setFeishuStatus({ logged_in: false });
    } catch (e) {
      setFeishuMsg(e instanceof Error ? e.message : '解除飞书绑定失败');
    } finally {
      setFeishuBusy(false);
    }
  }, []);

  const handleLogin = useCallback(async (a: AccountItem) => {
    if (!a.supported) return;
    if (a.backend === 'wechat-oa' || a.backend === 'cms') { openCred(a); return; }   // 凭证式平台走表单，不扫码
    setTerminalMsg('');
    setBusy(a.platform);
    setSmsCode(''); setSmsErr('');
    qrPlatformRef.current = a.platform;
    setQrNonce((n) => n + 1);
    try {
      const res = await startLogin(a.platform);
      if (res.mode === 'terminal') {
        setTerminalMsg(res.message || '请在终端登录');
        return;
      }
      if (res.mode === 'credentials') { openCred(a); return; }
      setQr({ platform: a.platform, name: a.name, state: res.state || 'starting',
              message: res.message || '', qr: res.qr || '' });   // qrTs 由随后的轮询填入
      stopPoll();
      pollRef.current = setInterval(async () => {
        try {
          const s = await loginStatus(a.platform);
          setQr((prev) => prev && ({ ...prev, state: s.state, message: s.message, qr: s.qr, qrTs: s.qrTs }));
          if (['success', 'expired', 'error'].includes(s.state)) {
            stopPoll();
            if (s.state === 'success') runWhoami(a.platform);   // 登录成功即拉账号信息
          }
        } catch { /* 忽略单次轮询失败 */ }
      }, 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '启动登录失败');
    } finally {
      setBusy('');
    }
  }, [stopPoll, runWhoami]);

  // 公众号后台扫码登录（数据中心取数用，独立于 AppID 凭证）
  const handleMpLogin = useCallback(async (a: AccountItem) => {
    setBusy(a.platform + ':mp');
    setSmsCode(''); setSmsErr('');
    setQrNonce((n) => n + 1);
    try {
      const res = await startMpLogin(a.platform);
      setQr({ platform: a.platform, name: a.name + ' · 后台取数', state: res.state || 'starting',
              message: res.message || '', qr: res.qr || '', qrTs: res.qrTs });
      stopPoll();
      pollRef.current = setInterval(async () => {
        try {
          const s = await mpLoginStatus(a.platform);
          setQr((prev) => prev && ({ ...prev, state: s.state, message: s.message, qr: s.qr, qrTs: s.qrTs }));
          if (['success', 'expired', 'error'].includes(s.state)) {
            stopPoll();
            if (s.state === 'success') {
              // 像快手一样“内存态立即翻”：wechat-oa 的 effLoggedIn 只看 a.loggedIn，这里直接把它乐观置 true，
              // 卡片瞬间变「已登录」，不必等 load() 那趟网络往返（后面 load() 再对账兜底）。
              setAccounts((list) => list.map((x) => x.platform === a.platform ? { ...x, loggedIn: true } : x));
              setWhoami((w) => { const n = { ...w }; delete n[a.platform]; return n; });
              setWhoamiCache(a.platform, null);
              runWhoami(a.platform);
              load();
            }
          }
        } catch { /* 忽略单次轮询失败 */ }
      }, 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '启动后台登录失败');
    } finally {
      setBusy('');
    }
  }, [stopPoll, runWhoami, load]);

  const handleLogout = useCallback(async (a: AccountItem) => {
    if (!window.confirm(`确定退出「${a.name}」的登录？登录态将被清除，下次发布需重新扫码。`)) return;
    setLogoutBusy(a.platform);
    try {
      await logoutAccount(a.platform);
      // 内存态立即翻未登录（同登录路径），不等 load() 回来
      setAccounts((list) => list.map((x) => x.platform === a.platform ? { ...x, loggedIn: false } : x));
      setWhoami((w) => { const n = { ...w }; delete n[a.platform]; return n; });
      setWhoamiCache(a.platform, null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '退出登录失败');
    } finally {
      setLogoutBusy('');
    }
  }, [load]);

  const handleRepair = useCallback(async (a: AccountItem) => {
    if (!window.confirm(`重置「${a.name}」的登录环境？\n会中断正在进行的登录/发布，清掉卡住的占用，然后自动校验；若未登录会直接拉起登录。`)) return;
    setRepairBusy(a.platform);
    setErr('');
    setTerminalMsg('');
    try {
      const r = await repairAccount(a.platform);
      const killed = r.cleanup?.killed?.length || 0;
      setWhoami((w) => ({ ...w, [a.platform]: r.whoami }));
      setWhoamiCache(a.platform, r.whoami);
      setAccounts((list) => list.map((x) => x.platform === a.platform ? { ...x, loggedIn: !!r.whoami?.loggedIn } : x));
      if (r.whoami?.loggedIn) {
        setTerminalMsg(`已重置并校验：「${a.name}」登录正常${killed ? `（清理了 ${killed} 个残留进程）` : ''}`);
        load();
        return;
      }
      setTerminalMsg(`已清理残留${killed ? `（${killed} 个进程）` : ''}，正在拉起「${a.name}」登录…`);
      await handleLogin(a);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '重置失败');
    } finally {
      setRepairBusy('');
    }
  }, [handleLogin, load]);

  // 卡片真实登录态：whoami 权威（已返回则以它为准，自愈假阳性），否则用后端 last-known。
  // 公众号(wechat-oa)例外：后端查 mp 会话即真值(快且权威)，直接用它，避免浏览器里过期的 whoami 缓存把已登录盖成未登录。
  const effLoggedIn = (a: AccountItem): boolean => {
    if (a.backend === 'wechat-oa') return a.loggedIn;
    const w = whoami[a.platform];
    if (w && w !== 'loading') return w.loggedIn;
    return a.loggedIn;
  };

  const badge = (a: AccountItem) => {
    if (!a.supported) return <span className="badge">待重写</span>;
    if (whoami[a.platform] === 'loading') return <span className="badge">校验中…</span>;
    if (effLoggedIn(a)) return <span className="badge badge-ok">✓ 已登录</span>;
    return <span className="badge">未登录</span>;
  };

  return (
    <div className="accounts-page">
      <div className="accounts-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="page-title"><IconAccounts size={21} /> 账号登录 Accounts</h1>
          <p className="page-subtitle">
            用手机 App 扫码登录，登录态本地持久化，之后发布免登。<br />
            ⚠️ 平台可能对机房/代理 IP 判风险导致二维码弹不出，需干净/家宽 IP，或在正常网络登录后拷贝登录态目录。
          </p>
        </div>
        <button className="btn btn-sm" onClick={load}>⟳ 刷新</button>
      </div>

      {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 12, maxWidth: 1100, marginLeft: 'auto', marginRight: 'auto' }}>{err}</div>}
      {terminalMsg && (
        <div className="card" style={{ padding: 13, fontSize: 13, marginTop: 14, maxWidth: 1100, marginLeft: 'auto', marginRight: 'auto' }}>{terminalMsg}</div>
      )}

      <div className="accounts-grid">
        {accounts.map((a) => {
          const w = whoami[a.platform];
          const info = w && w !== 'loading' ? w : null;
          const logged = effLoggedIn(a);
          return (
            <div key={a.platform} className="card account-card" style={{ opacity: a.supported ? 1 : 0.6 }}>
              <div className="account-card-head">
                <span className="account-card-name">{a.name}</span>
                {badge(a)}
              </div>

              {logged && info && (
                <div className="account-identity">
                  <Avatar url={info.avatar} name={info.name || a.name} />
                  <span className="account-nick">{info.name || '（已登录）'}</span>
                </div>
              )}
              {!logged && (
                <div className="account-card-note">{a.note ? a.note : `后端：${a.name}`}</div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                {logged ? (
                  <>
                    <button className="btn btn-sm" style={{ flex: 1 }}
                      disabled={busy === a.platform || busy === a.platform + ':mp' || w === 'loading'}
                      onClick={() => runWhoami(a.platform)}>
                      {w === 'loading' ? '校验中…' : '校验账号'}
                    </button>
                    {REPAIRABLE.has(a.platform) && (
                      <button className="btn btn-sm btn-ghost" style={{ flex: 1 }}
                        title="清掉卡住的登录/发布占用，然后自动校验；未登录会直接拉起登录"
                        disabled={repairBusy === a.platform || busy === a.platform}
                        onClick={() => handleRepair(a)}>
                        {repairBusy === a.platform ? '重置中…' : '重置'}
                      </button>
                    )}
                    <button className="btn btn-sm btn-ghost" style={{ flex: 1 }}
                      disabled={logoutBusy === a.platform}
                      onClick={() => handleLogout(a)}>
                      {logoutBusy === a.platform ? '退出中…' : '退出登录'}
                    </button>
                  </>
                ) : (
                  // 公众号与其它平台统一：都走扫码登录（公众号扫的是后台会话，用于发布+数据）
                  <>
                    {REPAIRABLE.has(a.platform) && (
                      <button className="btn btn-sm btn-ghost"
                        title="清掉卡住的登录/发布占用，然后自动校验；未登录会直接拉起登录"
                        disabled={repairBusy === a.platform || busy === a.platform}
                        onClick={() => handleRepair(a)}>
                        {repairBusy === a.platform ? '重置中…' : '重置'}
                      </button>
                    )}
                    <button
                      className={`btn btn-sm ${a.supported ? 'btn-primary' : ''}`}
                      style={{ flex: 1 }}
                      disabled={!a.supported || busy === a.platform || busy === a.platform + ':mp'}
                      onClick={() => (a.backend === 'wechat-oa' ? handleMpLogin(a) : handleLogin(a))}>
                      {(busy === a.platform || busy === a.platform + ':mp') ? '启动中…' : '登录'}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div className="card account-card">
          <div className="account-card-head">
            <span className="account-card-name">飞书</span>
            {feishuStatus?.logged_in
              ? <span className="badge badge-ok">✓ 已登录</span>
              : <span className="badge">{feishuMsg ? '等待授权…' : '未登录'}</span>}
          </div>
          <div className="account-identity">
            {feishuStatus?.logged_in
              ? <Avatar url={feishuStatus.avatar} name={feishuStatus.name || '飞书'} />
              : <div className="account-avatar account-avatar-fallback" style={{ background: '#3370ff', color: '#fff' }}>飞</div>}
            <span className="account-nick">{feishuStatus?.logged_in ? (feishuStatus.name || '已登录') : '多维表格 / 飞书文档'}</span>
          </div>
          {feishuMsg && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>{feishuMsg}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
            {feishuStatus?.logged_in ? (
              <>
                <button className="btn btn-sm" style={{ flex: 1 }} disabled={feishuBusy} onClick={() => void openFeishuLogin()}>
                  重新登录
                </button>
                <button className="btn btn-sm btn-ghost" style={{ flex: 1 }} disabled={feishuBusy} onClick={() => void handleFeishuLogout()}>
                  解除绑定
                </button>
              </>
            ) : (
              <button className="btn btn-block btn-primary" disabled={feishuBusy} onClick={() => void openFeishuLogin()}>
                {feishuBusy ? '启动中…' : '打开飞书登录'}
              </button>
            )}
          </div>
        </div>
      </div>

      {qr && (
        <div className="overlay" onClick={closeQr}>
          <div className="modal" style={{ width: 360, maxWidth: '100%', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px' }}>登录 {qr.name}</h3>
            <div style={{ fontSize: 13, marginBottom: 14,
              color: qr.state === 'success' ? 'var(--green)'
                : ['error', 'expired'].includes(qr.state) ? 'var(--red)' : 'var(--text-secondary)' }}>
              {STATE_LABEL[qr.state] || qr.state}{qr.message ? ` — ${qr.message}` : ''}
            </div>
            {qr.state === 'sms_required' ? (
              <div style={{ padding: '6px 4px 2px' }}>
                <div style={{ fontSize: 13, marginBottom: 10,
                  color: /错误|过期|失败|重新|未找到|未完成|不正确|失效/.test(qr.message || '')
                    ? 'var(--red)' : 'var(--text-secondary)' }}>
                  {qr.message || '平台风控要求短信验证，验证码已发到你手机，请输入：'}
                </div>
                <input
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitSms(); }}
                  placeholder="短信验证码" inputMode="numeric" autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center',
                    letterSpacing: 6, fontSize: 20, padding: '10px 12px',
                    border: '1px solid var(--border)', borderRadius: 8 }} />
                {smsErr && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{smsErr}</div>}
                <button className="btn btn-primary btn-block" style={{ marginTop: 12 }}
                  disabled={smsBusy} onClick={submitSms}>
                  {smsBusy ? '提交中…' : '提交验证码'}
                </button>
              </div>
            ) : qr.state === 'qr_ready' && qr.qr ? (
              <img className="qr-img" src={mediaUrl(qr.qr, qr.qrTs || qrNonce)} alt="登录二维码" />
            ) : qr.state === 'scanned' ? (
              <div className="loading" style={{ padding: 40 }}><div className="spinner" />扫码成功，正在跳转验证…（首次可能等十几秒）</div>
            ) : qr.state === 'verifying' ? (
              <div className="loading" style={{ padding: 40 }}><div className="spinner" />正在验证验证码，登录中…</div>
            ) : qr.state === 'success' ? (
              <div style={{ fontSize: 48, padding: 40 }}>✅</div>
            ) : ['error', 'expired'].includes(qr.state) ? (
              <div style={{ fontSize: 13, color: 'var(--red)', padding: 30 }}>
                {qr.message || '登录失败'}<br />可关闭后重试（或换干净 IP）。
              </div>
            ) : (
              <div className="loading" style={{ padding: 40 }}><div className="spinner" />准备二维码…</div>
            )}
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={closeQr}>{qr.state === 'success' ? '完成' : '关闭'}</button>
            </div>
          </div>
        </div>
      )}

      {cred && (
        <div className="overlay" onClick={closeCred}>
          <div className="modal" style={{ width: 420, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px' }}>配置 {cred.name}</h3>
            {cred.backend === 'cms' ? (
              <>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
                  {cred.platform === 'wordpress'
                    ? 'WordPress：站点地址 + 用户名 + 应用密码（用户 → 个人资料 → 应用程序密码）。'
                    : cred.platform === 'maywide'
                      ? '官网 Maywide：站点地址 + 后台账号 + 密码（默认后台 /admin）。'
                      : 'Typecho：站点地址 + 用户名 + 密码（需在后台启用 XML-RPC）。'}
                </div>
                {credMsg && <div style={{ fontSize: 12.5, color: 'var(--green)', marginBottom: 10 }}>{credMsg}</div>}
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>站点地址</label>
                <input value={cmsForm.siteUrl} autoFocus
                  onChange={(e) => setCmsForm((f) => ({ ...f, siteUrl: e.target.value.trim() }))}
                  placeholder="https://blog.example.com" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                    margin: '4px 0 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>用户名</label>
                <input value={cmsForm.username}
                  onChange={(e) => setCmsForm((f) => ({ ...f, username: e.target.value.trim() }))}
                  placeholder="admin" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                    margin: '4px 0 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>密码 / 应用密码</label>
                <input value={cmsForm.secret} type="password"
                  onChange={(e) => setCmsForm((f) => ({ ...f, secret: e.target.value.trim() }))}
                  placeholder="密码（不会回显）" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                    margin: '4px 0 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>显示名称（可选）</label>
                <input value={cmsForm.name}
                  onChange={(e) => setCmsForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="站点备注" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                    margin: '4px 0 4px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
                {credErr && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 8 }}>{credErr}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={credBusy} onClick={submitCred}>
                    {credBusy ? '验证中…' : '保存并验证'}
                  </button>
                  <button className="btn" onClick={closeCred}>关闭</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
                  公众号用官方接口发布，需填开发者凭证（公众平台 → 设置与开发 → 开发接口管理）。<br />
                  ⚠️ 需把本服务器出口 IP 加入公众号「IP 白名单」，否则报 40164。文章发到<b>草稿箱</b>，群发请到 mp 后台确认。
                </div>
                {credMsg && <div style={{ fontSize: 12.5, color: 'var(--green)', marginBottom: 10 }}>{credMsg}</div>}
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>AppID</label>
                <input value={credForm.appId} autoFocus
                  onChange={(e) => setCredForm((f) => ({ ...f, appId: e.target.value.trim() }))}
                  placeholder="wx..." style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                    margin: '4px 0 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>AppSecret</label>
                <input value={credForm.appSecret} type="password"
                  onChange={(e) => setCredForm((f) => ({ ...f, appSecret: e.target.value.trim() }))}
                  placeholder="开发者密钥（不会回显）" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                    margin: '4px 0 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>默认作者（可选）</label>
                <input value={credForm.author}
                  onChange={(e) => setCredForm((f) => ({ ...f, author: e.target.value }))}
                  placeholder="文章署名" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                    margin: '4px 0 4px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }} />
                {credErr && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 8 }}>{credErr}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={credBusy} onClick={submitCred}>
                    {credBusy ? '验证中…' : '保存并验证'}
                  </button>
                  <button className="btn" onClick={closeCred}>关闭</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
