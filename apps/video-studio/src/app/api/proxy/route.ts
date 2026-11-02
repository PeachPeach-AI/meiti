import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const allowPrivateProxy = process.env.ALLOW_PRIVATE_API_PROXY === 'true';
const allowedProxyHosts = new Set(
  (process.env.ALLOWED_API_PROXY_HOSTS || '')
    .split(',')
    .map((host) => normalizeHost(host))
    .filter(Boolean)
);

class ProxyTargetError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function GET(req: NextRequest) {
  return handleProxy(req, 'GET');
}

export async function POST(req: NextRequest) {
  return handleProxy(req, 'POST');
}

function normalizeHost(host: string) {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

function isBlockedHostname(host: string) {
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === 'host.docker.internal' ||
    host === 'metadata.google.internal'
  );
}

function isPrivateAddress(address: string) {
  const lower = address.toLowerCase();
  const mappedAddress = lower.startsWith('::ffff:') ? lower.slice(7) : lower;
  const version = isIP(mappedAddress);

  if (version === 4) {
    const parts = mappedAddress.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (version === 6) {
    return (
      mappedAddress === '::' ||
      mappedAddress === '::1' ||
      mappedAddress.startsWith('fc') ||
      mappedAddress.startsWith('fd') ||
      mappedAddress.startsWith('fe80:')
    );
  }

  return true;
}

async function assertAllowedTarget(targetUrl: string) {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    throw new ProxyTargetError('Invalid API Base URL');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ProxyTargetError('API Base URL must use http or https');
  }
  if (url.username || url.password) {
    throw new ProxyTargetError('API Base URL must not include credentials');
  }

  const host = normalizeHost(url.hostname);
  if (!host) throw new ProxyTargetError('API Base URL host is required');

  if (allowedProxyHosts.size > 0 && !allowedProxyHosts.has(host)) {
    throw new ProxyTargetError('API host is not allowed', 403);
  }

  if (!allowPrivateProxy) {
    if (isBlockedHostname(host)) {
      throw new ProxyTargetError('Private API hosts are disabled', 403);
    }

    const addresses = isIP(host)
      ? [host]
      : await lookup(host, { all: true }).then((items) => items.map((item) => item.address));

    if (addresses.some(isPrivateAddress)) {
      throw new ProxyTargetError('Private API addresses are disabled', 403);
    }
  }

  return url;
}

async function handleProxy(req: NextRequest, method: string) {
  const baseUrl = req.headers.get('X-Api-Base-Url');
  const apiKey = req.headers.get('X-Api-Key');
  const endpoint = req.headers.get('X-Api-Endpoint');

  if (!baseUrl || !apiKey || !endpoint) {
    return NextResponse.json({ error: 'Missing API config headers' }, { status: 400 });
  }

  const targetUrl = baseUrl.replace(/\/+$/, '') + '/' + endpoint.replace(/^\/+/, '');
  let target: URL;
  try {
    target = await assertAllowedTarget(targetUrl);
  } catch (e) {
    if (e instanceof ProxyTargetError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : 'Invalid API target';
    return NextResponse.json({ error: msg.slice(0, 300) }, { status: 400 });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };

  let body: string | undefined;
  if (method === 'POST' || method === 'PUT') {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      body = await req.text();
      headers['Content-Type'] = 'application/json';
    }
  }

  try {
    const res = await fetch(target.toString(), {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(120000),
    });

    const text = await res.text();

    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      return NextResponse.json({ error: 'API returned HTML, check your Base URL' }, { status: 502 });
    }

    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: res.status });
    } catch {
      return new NextResponse(text, {
        status: res.status,
        headers: { 'Content-Type': res.headers.get('content-type') || 'text/plain' },
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('timeout') || msg.includes('aborted')) {
      return NextResponse.json({ error: 'Request timeout (120s)' }, { status: 504 });
    }
    return NextResponse.json({ error: msg.slice(0, 300) }, { status: 502 });
  }
}