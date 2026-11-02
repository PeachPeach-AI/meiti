import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes } from 'crypto';
import { getDb, save } from '@/lib/db';

function hashPassword(password: string, salt: string): string {
  return createHmac('sha256', salt).update(password).digest('hex');
}

async function handleRequest(req: NextRequest) {
  const db = await getDb();
  const action = req.nextUrl.searchParams.get('action') || 'login';
  const isGet = req.method === 'GET';
  const body = isGet ? {} : await req.json().catch(() => ({}));

  // 验证 token (GET: me, load_settings)
  if (action === 'me') {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ success: false, message: '未登录' }, { status: 401 });
    try {
      const [id, h] = token.split(':');
      const rows = db.exec("SELECT id, username, password_hash FROM users WHERE id = ?", [parseInt(id)]);
      if (rows.length > 0 && rows[0].values.length > 0) {
        const [uid, username, pwHash] = rows[0].values[0] as [number, string, string];
        if (hashPassword(pwHash, 'verify') === h) {
          return NextResponse.json({ success: true, user: { id: uid, username } });
        }
      }
    } catch {}
    return NextResponse.json({ success: false, message: '登录已过期' }, { status: 401 });
  }

  // 读取设置 (GET: load_settings)
  if (action === 'load_settings') {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ success: false });

    try {
      const [idStr] = token.split(':');
      const uid = parseInt(idStr);
      const rows = db.exec("SELECT key, value FROM user_settings WHERE user_id = ?", [uid]);
      const settings: Record<string, string> = {};
      if (rows.length > 0) {
        for (const row of rows[0].values) {
          settings[row[0] as string] = row[1] as string || '';
        }
      }
      return NextResponse.json({ success: true, settings });
    } catch { return NextResponse.json({ success: false }); }
  }

  // POST-only actions below
  if (isGet) return NextResponse.json({ success: false, message: '无效请求' }, { status: 400 });

  // 登录
  if (action === 'login') {
    const { username, password } = body;
    const rows = db.exec("SELECT id, username, password_hash, salt FROM users WHERE username = ? OR email = ?", [username, username]);
    if (rows.length === 0 || rows[0].values.length === 0) {
      return NextResponse.json({ success: false, message: '用户名或邮箱不存在' }, { status: 401 });
    }
    const [id, uname, pwHash, salt] = rows[0].values[0] as [number, string, string, string];
    if (hashPassword(password, salt) !== pwHash) {
      return NextResponse.json({ success: false, message: '密码错误' }, { status: 401 });
    }
    const token = `${id}:${hashPassword(pwHash, 'verify')}`;
    return NextResponse.json({ success: true, user: { id, username: uname }, token });
  }

  // 注册
  if (action === 'register') {
    const { username, email, password } = body;
    if (!username || username.length < 3) return NextResponse.json({ success: false, message: '用户名至少3位' }, { status: 400 });
    if (!password || password.length < 6) return NextResponse.json({ success: false, message: '密码至少6位' }, { status: 400 });
    const exist = db.exec("SELECT id FROM users WHERE username = ? OR email = ?", [username, email]);
    if (exist.length > 0 && exist[0].values.length > 0) {
      return NextResponse.json({ success: false, message: '用户名或邮箱已存在' }, { status: 409 });
    }
    const salt = randomBytes(16).toString('hex');
    const pwHash = hashPassword(password, salt);
    db.run("INSERT INTO users (username, email, password_hash, salt) VALUES (?, ?, ?, ?)", [username, email, pwHash, salt]);
    const newRows = db.exec("SELECT id, username FROM users WHERE username = ?", [username]);
    const [id, uname] = newRows[0].values[0] as [number, string];
    save();
    const token = `${id}:${hashPassword(pwHash, 'verify')}`;
    return NextResponse.json({ success: true, user: { id, username: uname }, token });
  }

  // 保存设置
  if (action === 'save_settings') {
    const { token, settings } = body;
    if (!token) return NextResponse.json({ success: false, message: '未登录' }, { status: 401 });
    const [idStr] = token.split(':');
    const uid = parseInt(idStr);
    for (const [key, value] of Object.entries(settings as Record<string, string>)) {
      db.run("INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = ?", [uid, key, value, value]);
    }
    save();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, message: '无效请求' }, { status: 400 });
}

export async function GET(req: NextRequest) {
  try { return await handleRequest(req); }
  catch (e) { console.error('[auth] GET error:', e); return NextResponse.json({ success: false, message: `服务器错误: ${(e as Error).message}` }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try { return await handleRequest(req); }
  catch (e) { console.error('[auth] POST error:', e); return NextResponse.json({ success: false, message: `服务器错误: ${(e as Error).message}` }, { status: 500 }); }
}
