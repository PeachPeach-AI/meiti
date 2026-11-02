'use client'

import React from 'react'
import { useAppStore } from '@/store'
import { LockKeyhole, RefreshCw, Sun, Moon, WandSparkles, CreditCard, X, Check, ClipboardPaste, Wand2, ShieldCheck, Clock, Zap, ExternalLink } from 'lucide-react'

const PLAN_INFO: Record<string, { name: string; desc: string; quota: number; days: number }> = {
  '体验卡': { name: '体验卡', desc: '7 天有效', quota: 10, days: 7 },
  '周卡': { name: '周卡', desc: '7 天有效', quota: 70, days: 7 },
  '月卡': { name: '月卡', desc: '30 天有效', quota: 300, days: 30 },
}

interface ParsedCard {
  plan: string
  imageKey: string
  imageUrl: string
  imageModel: string
  textKey: string
  textUrl: string
  textModel: string
}

function parseCardKey(input: string): ParsedCard | null {
  const trimmed = input.trim()
  if (trimmed.startsWith('{')) {
    try {
      const j = JSON.parse(trimmed)
      return {
        plan: j.plan || j.PLAN || '',
        imageKey: j.image?.key || j.image_key || '',
        imageUrl: j.image?.url || j.image_url || '',
        imageModel: j.image?.model || j.image_model || '',
        textKey: j.text?.key || j.text_key || '',
        textUrl: j.text?.url || j.text_url || '',
        textModel: j.text?.model || j.text_model || '',
      }
    } catch { /* */ }
  }
  const map: Record<string, string> = {}
  for (const line of trimmed.split('\n')) {
    const eq = line.indexOf('=')
    if (eq === -1) continue
    map[line.slice(0, eq).trim().toUpperCase()] = line.slice(eq + 1).trim()
  }
  return {
    plan: map['PLAN'] || '',
    imageKey: map['IMAGE_KEY'] || '',
    imageUrl: map['IMAGE_URL'] || '',
    imageModel: map['IMAGE_MODEL'] || '',
    textKey: map['TEXT_KEY'] || '',
    textUrl: map['TEXT_URL'] || '',
    textModel: map['TEXT_MODEL'] || '',
  }
}

// ============ Tab: 卡密兑换 ============
function CardImportTab({ onClose }: { onClose: () => void }) {
  const [input, setInput] = React.useState('')
  const [preview, setPreview] = React.useState<ParsedCard | null>(null)
  const [applied, setApplied] = React.useState(false)

  const {
    setImageApiKey, setImageApiBaseUrl, setSelectedImageModel,
    setTextApiKey, setTextApiBaseUrl, setSelectedTextModel,
    setCurrentPlan,
  } = useAppStore()

  const handleParse = () => {
    const p = parseCardKey(input)
    if (!p || (!p.imageKey && !p.textKey)) { setPreview(null); return }
    setPreview(p)
    setApplied(false)
  }

  const handleApply = () => {
    if (!preview) return
    if (preview.imageKey) { setImageApiKey(preview.imageKey); setImageApiBaseUrl(preview.imageUrl) }
    if (preview.imageModel) setSelectedImageModel(preview.imageModel)
    if (preview.textKey) { setTextApiKey(preview.textKey); setTextApiBaseUrl(preview.textUrl) }
    if (preview.textModel) setSelectedTextModel(preview.textModel)
    if (preview.plan && PLAN_INFO[preview.plan]) {
      setCurrentPlan(preview.plan, PLAN_INFO[preview.plan].name, PLAN_INFO[preview.plan].days)
    }
    setApplied(true)
    setTimeout(onClose, 1200)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-app-text-secondary">粘贴卡密，自动识别套餐与模型配置，一键写入浏览器</p>

      {applied ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center"><Check size={28} className="text-white" /></div>
          <strong className="text-base text-app-text">配置完成</strong>
          <span className="text-xs text-app-text-secondary">图片/文本模型配置已全部写入浏览器</span>
        </div>
      ) : (
        <>
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); setPreview(null) }}
            placeholder={`PLAN=周卡
IMAGE_KEY=sk-xxxxxxxx
IMAGE_URL=https://api.example.com/v1
IMAGE_MODEL=gpt-image-2
TEXT_KEY=sk-yyyyyyyy
TEXT_URL=https://api.example.com/v1
TEXT_MODEL=gpt-4o-mini`}
            rows={8}
            className="w-full rounded-lg border border-app-border bg-app-bg-alt px-3 py-2.5 text-xs text-app-text placeholder:text-app-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
          />

          <div className="flex gap-2">
            <button type="button" onClick={handleParse} disabled={!input.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm border border-app-border text-app-text-secondary hover:bg-app-bg-hover disabled:opacity-40">
              <Wand2 size={14} /> 解析卡密
            </button>
            {preview && (
              <button type="button" onClick={handleApply} className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700">
                <ClipboardPaste size={14} /> 一键配置
              </button>
            )}
          </div>

          {preview && (
            <div className="rounded-lg border border-app-border bg-app-bg-alt p-4 space-y-3">
              {preview.plan && PLAN_INFO[preview.plan] && (
                <div className="flex items-center gap-2 pb-3 border-b border-app-border">
                  <ShieldCheck size={16} className="text-green-500" />
                  <span className="text-sm font-medium text-app-text">{PLAN_INFO[preview.plan].name}</span>
                  <span className="text-xs text-app-text-muted">{PLAN_INFO[preview.plan].desc}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ml-auto">{PLAN_INFO[preview.plan].quota} 次</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {preview.imageKey && (
                  <div>
                    <span className="text-2xs text-app-text-muted uppercase tracking-wide">图片模型</span>
                    <div className="mt-1 space-y-0.5 text-xs">
                      <div className="text-app-text font-mono truncate">Key: {preview.imageKey.slice(0, 16)}…</div>
                      <div className="text-app-text font-mono truncate">URL: {preview.imageUrl}</div>
                      <div className="text-app-text font-mono">Model: {preview.imageModel}</div>
                    </div>
                  </div>
                )}
                {preview.textKey && (
                  <div>
                    <span className="text-2xs text-app-text-muted uppercase tracking-wide">文本模型</span>
                    <div className="mt-1 space-y-0.5 text-xs">
                      <div className="text-app-text font-mono truncate">Key: {preview.textKey.slice(0, 16)}…</div>
                      <div className="text-app-text font-mono truncate">URL: {preview.textUrl}</div>
                      <div className="text-app-text font-mono">Model: {preview.textModel}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============ Tab: 订购 ============
const PLANS = [
  { id: '体验卡', name: '体验卡', price: '¥0.99', cycle: '7 天', quota: '10 次', desc: '含少量体验额度，适合验证工作流。单人限购一次。' },
  { id: '周卡', name: '周卡', price: '¥19.9', cycle: '7 天', quota: '70 次', desc: '适合短期批量出图和项目冲刺，可多次订购。' },
  { id: '月卡', name: '月卡', price: '¥69.9', cycle: '30 天', quota: '300 次', desc: '适合持续创作、商品图和内容生产，可多次订购。' },
]

function PurchaseTab() {
  const [selectedPlan, setSelectedPlan] = React.useState('周卡')
  const selected = PLANS.find((p) => p.id === selectedPlan) || PLANS[1]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setSelectedPlan(plan.id)}
            className={`rounded-lg border px-4 py-4 text-left transition-colors ${
              selectedPlan === plan.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-app-border hover:bg-app-bg-hover text-app-text-secondary'
            }`}
          >
            <strong className="block text-sm">{plan.name}</strong>
            <span className="mt-2 block text-xl font-bold text-app-text">{plan.price}</span>
            <div className="flex items-center gap-2 mt-1">
              <small className="text-2xs text-app-text-muted">{plan.cycle}</small>
              <small className="text-2xs text-app-text-muted">·</small>
              <small className="text-2xs text-app-text-muted">{plan.quota}</small>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-app-border bg-app-bg-alt p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-app-text-secondary">订购金额</span>
          <strong className="text-2xl text-app-text">{selected.price}</strong>
        </div>
        <p className="mt-2 text-xs text-app-text-muted">{selected.desc}</p>
        <button
          type="button"
          onClick={() => window.open('https://m.tb.cn/h.RurFHLi?tk=W2t5gQyt0I6', '_blank')}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600"
        >
          立即订购 <ExternalLink size={14} />
        </button>
      </div>

      <div className="rounded-lg bg-app-bg-alt p-3 text-xs text-app-text-secondary leading-relaxed">
        <strong className="block mb-1 text-app-text">订购说明</strong>
        支付后自动发放卡密，在「卡密兑换」页粘贴即可一键激活。额度按天刷新，到期未用完不累计。
      </div>
    </div>
  )
}

// ============ Tab: 订阅查询 ============
const BILLING_LOGS = [
  { time: '2026-06-30 10:20', item: '生图任务', amount: '-1 次', status: '成功' },
  { time: '2026-06-30 09:58', item: '提示词联想', amount: '-1 次', status: '成功' },
  { time: '2026-06-29 18:12', item: '周卡兑换', amount: '¥0', status: '已激活' },
  { time: '2026-06-29 15:40', item: '生图任务', amount: '-1 次', status: '成功' },
  { time: '2026-06-29 14:22', item: '生图任务', amount: '-1 次', status: '成功' },
  { time: '2026-06-29 11:05', item: '生图任务', amount: '-1 次', status: '成功' },
  { time: '2026-06-28 22:30', item: '文档生图', amount: '-1 次', status: '成功' },
  { time: '2026-06-28 16:10', item: '生图任务', amount: '-1 次', status: '失败' },
  { time: '2026-06-28 10:50', item: '生图任务', amount: '-1 次', status: '成功' },
  { time: '2026-06-27 19:15', item: '生图任务', amount: '-1 次', status: '成功' },
  { time: '2026-06-27 12:30', item: '提示词联想', amount: '-1 次', status: '成功' },
  { time: '2026-06-26 20:00', item: '生图任务', amount: '-1 次', status: '成功' },
]

function BillingTab() {
  const currentPlan = useAppStore((s) => s.currentPlan)
  const currentPlanName = useAppStore((s) => s.currentPlanName)
  const planExpiredAt = useAppStore((s) => s.planExpiredAt)
  const planInfo = currentPlan ? PLAN_INFO[currentPlan] : null

  const usedCredits = React.useMemo(() => {
    if (!currentPlan) return 0
    return BILLING_LOGS
      .filter((l) => l.status === '成功' && l.amount.startsWith('-'))
      .reduce((sum, l) => sum + Math.abs(parseFloat(l.amount)), 0)
  }, [currentPlan])

  const totalQuota = planInfo?.quota ?? 0
  const remaining = Math.max(0, totalQuota - usedCredits)
  const pct = totalQuota > 0 ? Math.round((remaining / totalQuota) * 100) : 0

  return (
    <div className="space-y-4">
      {/* 当前订阅状态 */}
      <div className="rounded-lg border border-app-border bg-app-bg-alt p-4">
        <span className="text-xs text-app-text-muted">当前订阅</span>
        {currentPlan ? (
          <div className="mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-green-500" />
              <strong className="text-base text-app-text">{currentPlanName || currentPlan}</strong>
              <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">已激活</span>
            </div>
            {planInfo && (
              <div className="flex items-center gap-4 text-xs text-app-text-secondary flex-wrap">
                <span className="flex items-center gap-1"><Clock size={12} />{planInfo.desc}</span>
                <span className="flex items-center gap-1"><Zap size={12} />总额度 {planInfo.quota} 次</span>
                {planExpiredAt > 0 && (
                  <span className={`flex items-center gap-1 ${Date.now() > planExpiredAt ? 'text-red-500' : 'text-app-text-secondary'}`}>
                    到期 {new Date(planExpiredAt).toLocaleDateString('zh-CN')}
                    {Date.now() > planExpiredAt && <span className="text-2xs px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/30">已过期</span>}
                  </span>
                )}
              </div>
            )}
            {/* 剩余额度 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-app-text-secondary">剩余额度</span>
                <span className="text-app-text font-medium">{remaining} / {totalQuota} 次</span>
              </div>
              <div className="w-full h-2 rounded-full bg-app-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct > 20 ? 'bg-green-500' : pct > 5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-2xs text-app-text-muted">
                <span>已用 {usedCredits.toFixed(1)} 次</span>
                <span>剩余 {pct}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CreditCard size={28} className="text-app-text-muted" />
            <span className="text-sm text-app-text-secondary">暂无订阅</span>
            <span className="text-xs text-app-text-muted">去「订阅」页面购买，或「卡密兑换」激活</span>
          </div>
        )}
      </div>

      {/* 扣费日志 */}
      <div className="rounded-lg border border-app-border bg-app-bg-alt p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-app-text">扣费日志</span>
          <span className="text-2xs text-app-text-muted">最近 7 天</span>
        </div>
        <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
          {BILLING_LOGS.map((log, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2 rounded text-xs hover:bg-app-bg-hover">
              <span className="text-app-text flex-1">{log.item}</span>
              <span className={`shrink-0 tabular-nums ${log.amount.startsWith('-') ? 'text-app-text-secondary' : 'text-green-600'}`}>{log.amount}</span>
              <span className="shrink-0 text-2xs text-app-text-muted w-20 text-right">{log.time.slice(5)}</span>
              <span className={`shrink-0 text-2xs w-10 text-right ${log.status === '成功' || log.status === '已激活' ? 'text-green-600' : 'text-app-text-muted'}`}>{log.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============ Dialog ============
const TABS = [
  { key: 'purchase', label: '订阅', icon: CreditCard },
  { key: 'card', label: '卡密兑换', icon: Wand2 },
  { key: 'billing', label: '订阅查询', icon: ShieldCheck },
] as const

function SubscriptionDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = React.useState<'purchase' | 'card' | 'billing'>('purchase')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg mx-2 sm:mx-4 rounded-xl border border-app-border bg-app-bg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-app-border">
          <h2 className="text-base font-semibold text-app-text">订阅与额度</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-app-bg-hover text-app-text-muted"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-app-border">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm transition-colors ${
                tab === key
                  ? 'text-blue-600 border-b-2 border-blue-600 font-medium'
                  : 'text-app-text-secondary hover:text-app-text hover:bg-app-bg-alt'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {tab === 'card' && <CardImportTab onClose={onClose} />}
          {tab === 'purchase' && <PurchaseTab />}
          {tab === 'billing' && <BillingTab />}
        </div>
      </div>
    </div>
  )
}

// ============ Topbar ============
export function Topbar() {
  const imageApiKey = useAppStore((s) => s.imageApiKey)
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)
  const [subOpen, setSubOpen] = React.useState(false)

  return (
    <>
      <section className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 border-b border-app-border bg-app-bg shrink-0">
        <button onClick={() => window.location.reload()} className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80" type="button">
          <span className="text-blue-500"><WandSparkles size={18} /></span>
          <div className="text-left leading-tight">
            <h1 className="text-xs sm:text-sm font-semibold text-app-text">Image2 Studio</h1>
            <p className="hidden sm:block text-2xs text-app-text-muted">独立生图工作台</p>
          </div>
        </button>

        <div className="flex items-center gap-1 sm:gap-2">
          <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-app-bg-alt text-app-text-secondary">
            <LockKeyhole size={13} />
            {imageApiKey ? '已填写' : '未填写'}
          </span>
          <button onClick={() => window.location.reload()} className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md text-xs text-app-text-secondary hover:bg-app-bg-hover" type="button">
            <RefreshCw size={13} />刷新
          </button>
          <button onClick={() => setSubOpen(true)} className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md text-xs text-app-text-secondary hover:bg-app-bg-hover" type="button">
            <CreditCard size={13} />订阅
          </button>
          <button onClick={toggleTheme} className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md text-xs text-app-text-secondary hover:bg-app-bg-hover" type="button">
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
      </section>
      {subOpen && <SubscriptionDialog onClose={() => setSubOpen(false)} />}
    </>
  )
}
