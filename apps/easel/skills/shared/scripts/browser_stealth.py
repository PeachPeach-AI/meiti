#!/usr/bin/env python3
"""browser_stealth.py — 让 Playwright 无头浏览器看起来像普通 Chrome。

为什么需要：Playwright 默认 UA 含 `HeadlessChrome`，且 headless 下
`navigator.plugins` 为空、`window.chrome` 不存在、`navigator.userAgentData`
的品牌里写着 HeadlessChrome。抖音/小红书这类平台的风控会据此判定自动化，
表现为反复弹短信验证、登录态被强制断开。

用法：
    kwargs = dict(headless=True, locale="zh-CN", args=[...])
    kwargs.update(stealth.context_kwargs())
    ctx = p.chromium.launch_persistent_context(profile, **kwargs)
    ctx.add_init_script(stealth.INIT_SCRIPT)
"""
from __future__ import annotations

from typing import Any

# 与当前 Playwright 内核大版本一致；UA / UA-CH / 高熵值都从这里派生。
CHROME_MAJOR = "153"
CHROME_FULL = "153.0.8010.12"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    f"(KHTML, like Gecko) Chrome/{CHROME_MAJOR}.0.0.0 Safari/537.36"
)

BRANDS = [
    {"brand": "Chromium", "version": CHROME_MAJOR},
    {"brand": "Google Chrome", "version": CHROME_MAJOR},
    {"brand": "Not.A/Brand", "version": "24"},
]

EXTRA_HTTP_HEADERS = {
    "sec-ch-ua": '"Chromium";v="%s", "Google Chrome";v="%s", "Not.A/Brand";v="24"'
    % (CHROME_MAJOR, CHROME_MAJOR),
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
}

VIEWPORT = {"width": 1440, "height": 900}


def context_kwargs() -> dict[str, Any]:
    """可直接 merge 进 launch_persistent_context 的参数。"""
    return {
        "user_agent": USER_AGENT,
        "viewport": dict(VIEWPORT),
        "screen": dict(VIEWPORT),
        "device_scale_factor": 1,
        "is_mobile": False,
        "has_touch": False,
        "timezone_id": "Asia/Shanghai",
        "extra_http_headers": dict(EXTRA_HTTP_HEADERS),
    }


INIT_SCRIPT = r"""
(() => {
  const ua = navigator.userAgent || '';
  const major = (ua.match(/Chrome\/(\d+)/) || [null, '153'])[1];
  const full = major + '.0.8010.12';
  const brands = [
    { brand: 'Chromium', version: major },
    { brand: 'Google Chrome', version: major },
    { brand: 'Not.A/Brand', version: '24' },
  ];
  const highEntropy = {
    architecture: 'x86',
    bitness: '64',
    brands: brands,
    fullVersionList: brands.map(b => ({ brand: b.brand, version: full })),
    model: '',
    platform: 'Windows',
    platformVersion: '15.0.0',
    uaFullVersion: full,
    wow64: false,
  };
  try {
    Object.defineProperty(Navigator.prototype, 'userAgentData', {
      configurable: true,
      get: () => ({
        brands: brands,
        mobile: false,
        platform: 'Windows',
        getHighEntropyValues: async (hints) => {
          const out = {};
          for (const h of (hints || [])) {
            if (Object.prototype.hasOwnProperty.call(highEntropy, h)) out[h] = highEntropy[h];
          }
          return out;
        },
        toJSON: () => ({ brands: brands, mobile: false, platform: 'Windows' }),
      }),
    });
  } catch (e) {}
  try { Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => undefined }); } catch (e) {}
  try {
    Object.defineProperty(Navigator.prototype, 'languages', {
      configurable: true,
      get: () => ['zh-CN', 'zh'],
    });
  } catch (e) {}
  try {
    Object.defineProperty(Navigator.prototype, 'plugins', {
      configurable: true,
      get: () => [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' },
        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer' },
      ],
    });
  } catch (e) {}
  try { Object.defineProperty(Navigator.prototype, 'pdfViewerEnabled', { configurable: true, get: () => true }); } catch (e) {}
  if (!window.chrome) {
    window.chrome = {
      app: { isInstalled: false, InstallState: { DISABLED: 'disabled' }, RunningState: { RUNNING: 'running' } },
      runtime: {},
      csi: () => ({}),
      loadTimes: () => ({}),
    };
  }
})();
"""
