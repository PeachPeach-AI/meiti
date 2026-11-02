import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const provider = body.provider || process.env.OSS_PROVIDER;
    const accessKey = process.env.OSS_ACCESS_KEY || body.accessKey;
    const accessSecret = process.env.OSS_ACCESS_SECRET || body.accessSecret;
    const bucket = process.env.OSS_BUCKET || body.bucket;
    const region = process.env.OSS_REGION || body.region;
    const endpoint = process.env.OSS_ENDPOINT || body.endpoint;
    const customDomain = process.env.OSS_CUSTOM_DOMAIN || body.customDomain;
    const filename = body.filename;

    if (!accessKey || !accessSecret || !bucket) {
      return NextResponse.json({ error: '配置不完整' }, { status: 400 });
    }

    const dir = process.env.OSS_UPLOAD_DIR || 'video-studio/';
    const key = dir + Date.now() + '_' + Math.random().toString(36).slice(2) + '_' + (filename || 'image.jpg');

    let host: string;
    if (customDomain) {
      host = customDomain;
    } else if (endpoint) {
      host = endpoint;
    } else if (provider === 'tencent') {
      host = `https://${bucket}.cos.${region || 'ap-guangzhou'}.myqcloud.com`;
    } else {
      host = `https://${bucket}.${region || 'oss-cn-hangzhou'}.aliyuncs.com`;
    }

    const policy = Buffer.from(JSON.stringify({
      expiration: new Date(Date.now() + 3600000).toISOString(),
      conditions: [
        ['content-length-range', 0, 10485760],
        ['starts-with', '$key', dir],
      ],
    })).toString('base64');

    const signature = createHmac('sha1', accessSecret).update(policy).digest('base64');

    return NextResponse.json({ host, key, policy, signature, accessId: accessKey });
  } catch {
    return NextResponse.json({ error: '签名生成失败' }, { status: 500 });
  }
}