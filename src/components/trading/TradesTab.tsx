'use client'

import type { FullState, Trade } from '@/lib/trading-types'
import { fmtMoney, pnlClass } from './HomeTab'
import { OpenTradeRow } from './HomeTab'
import { Trophy, TrendingUp, Download, Flame, Snowflake } from "lucide-react"

/** Cumulative-PnL curve (equity curve) built from closed trades, oldest first. */
function EquityCurve({ trades, balance, totalPnl }: { trades: Trade[]; balance: number; totalPnl: number }) {
  const H = 110
  const W = 320
  const closed = trades
    .filter(t => t.status === 'closed')
    .slice()
    .sort((a, b) => (a.closeTime ?? a.openTime) - (b.closeTime ?? b.openTime))

  if (closed.length < 2) {
    return (
      <div style={{ height: H }} className="flex items-center justify-center text-xs text-[#8d7b5e]">
        بعد از چند معامله، نمودار رشد سرمایه اینجا رسم می‌شود
      </div>
    )
  }

  // start balance = current balance minus everything earned so far
  let cum = +(balance - totalPnl).toFixed(2)
  const points: number[] = [cum]
  for (const t of closed) {
    cum = +(cum + (t.pnl ?? 0)).toFixed(2)
    points.push(cum)
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const up = points[points.length - 1] >= points[0]
  const stroke = up ? '#f5b52a' : '#f4536b'

  const pts = points.map((v, i) => {
    const x = (i / (points.length - 1)) * (W - 6) + 3
    const y = H - 10 - ((v - min) / range) * (H - 24)
    return [x, y] as const
  })
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `0,${H} ${line} ${W},${H}`
  const last = pts[pts.length - 1]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" preserveAspectRatio="none" role="img" aria-label="نمودار رشد سرمایه">
        <defs>
          <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? 'rgba(245,181,42,0.25)' : 'rgba(244,83,107,0.25)'} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#2c251e" strokeDasharray="3 6" strokeWidth="1" />
        ))}
        <polygon points={area} fill="url(#eqfill)" />
        <polyline points={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r="3.5" fill={stroke} />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[#8d7b5e] tabular-nums">
        <span dir="ltr">{fmtMoney(points[0])}</span>
        <span className="font-bold" dir="ltr" style={{ color: stroke }}>{fmtMoney(points[points.length - 1])}</span>
      </div>
    </div>
  )
}

function StatCell({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-xl bg-black/30 p-2">
      <div className="text-[10px] text-[#a89d8d]">{label}</div>
      <div className={`text-sm font-black tabular-nums ${cls ?? ''}`}>{value}</div>
    </div>
  )
}

function streakInfo(streak: number): { label: string; cls: string; icon: typeof Flame } {
  if (streak > 0) return { label: `${streak} برد پیاپی`, cls: 'text-[#35c98e]', icon: Flame }
  if (streak < 0) return { label: `${Math.abs(streak)} باخت پیاپی`, cls: 'text-[#f4536b]', icon: Snowflake }
  return { label: '—', cls: 'text-stone-400', icon: Snowflake }
}

function exportCsv(trades: Trade[]) {
  const header = ['زمان باز شدن', 'جهت', 'حالت', 'حجم', 'قیمت ورود', 'قیمت خروج', 'نتیجه', 'سود/زیان ($)', 'اطمینان %', 'دلیل AI']
  const rows = trades.map(t => [
    new Date(t.openTime).toISOString(),
    t.direction,
    t.mode === 'demo' ? 'demo' : 'MT5',
    t.stake > 0 ? `$${t.stake}` : `${t.lots} lot`,
    t.openPrice.toFixed(2),
    t.closePrice?.toFixed(2) ?? '',
    t.result ?? '',
    (t.pnl ?? 0).toFixed(2),
    String(t.confidence),
    (t.aiReason || t.comment || '').replace(/[\n",]/g, ' '),
  ])
  const csv = '\uFEFF' + [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gold-trades-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function TradesTab({
  state,
  now,
  onCloseTrade,
}: {
  state: FullState
  now: number
  onCloseTrade: (id: string) => void
}) {
  const open = state.trades.filter(t => t.status === 'open')
  const closed = state.trades.filter(t => t.status === 'closed')
  const s = state.stats

  const grossLossAbs = Math.abs(s.grossLoss)
  const profitFactor = s.losses === 0 || grossLossAbs === 0
    ? (s.wins > 0 ? '∞' : '—')
    : (s.grossProfit / grossLossAbs).toFixed(2)
  const streak = streakInfo(s.streak)
  const StreakIcon = streak.icon

  return (
    <div className="space-y-3">
      {/* Stats */}
      <section className="rounded-2xl border border-[#3a2f1d] bg-gradient-to-b from-[#211a0e] to-[#171310] p-4" aria-label="آمار کلی">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#f5b52a]" />
            <h2 className="text-sm font-bold">عملکرد بات</h2>
          </div>
          <button
            onClick={() => exportCsv(state.trades)}
            disabled={closed.length === 0}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold ${
              closed.length === 0 ? 'bg-black/30 text-stone-600' : 'bg-[#f5b52a]/15 text-[#f5b52a] active:bg-[#f5b52a]/30'
            }`}
            aria-label="خروجی اکسل تاریخچه"
          >
            <Download className="h-3 w-3" /> خروجی CSV
          </button>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <StatCell label="نرخ برد" value={`${s.winRate}٪`} cls="text-[#f5b52a]" />
          <StatCell label="برد" value={String(s.wins)} cls="text-[#35c98e]" />
          <StatCell label="باخت" value={String(s.losses)} cls="text-[#f4536b]" />
          <StatCell label="سود کل" value={fmtMoney(s.totalPnl, true)} cls={pnlClass(s.totalPnl)} />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <StatCell label="بهترین" value={s.bestTrade > 0 ? fmtMoney(s.bestTrade, true) : '—'} cls="text-[#35c98e]" />
          <StatCell label="بدترین" value={s.worstTrade < 0 ? fmtMoney(s.worstTrade, true) : '—'} cls="text-[#f4536b]" />
          <StatCell label="ضریب سود" value={profitFactor} cls={profitFactor !== '—' && profitFactor !== '∞' && Number(profitFactor) >= 1 ? 'text-[#35c98e]' : 'text-stone-300'} />
          <div className="rounded-xl bg-black/30 p-2">
            <div className="text-[10px] text-[#a89d8d]">استریک فعلی</div>
            <div className={`flex items-center justify-center gap-1 text-sm font-black tabular-nums ${streak.cls}`}>
              <StreakIcon className="h-3.5 w-3.5" /> {s.streak === 0 ? '—' : streak.label}
            </div>
          </div>
        </div>
      </section>

      {/* Equity curve */}
      <section className="rounded-2xl border border-border bg-card p-4" aria-label="نمودار رشد سرمایه">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#f5b52a]" />
            <h2 className="text-sm font-bold">رشد سرمایه</h2>
          </div>
          <span className="text-[10px] text-[#a89d8d]">از ابتدا تا الان</span>
        </div>
        <div className="mt-2">
          <EquityCurve trades={state.trades} balance={state.balance} totalPnl={s.totalPnl} />
        </div>
      </section>

      {/* Open trades with live countdown + close */}
      <section className="rounded-2xl border border-border bg-card p-4" aria-label="معامله‌های باز">
        <h2 className="text-sm font-bold">باز ({open.length})</h2>
        {open.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#a89d8d]">معامله بازی وجود ندارد</p>
        ) : (
          <div className="mt-2 space-y-2">
            {open.map(t => (
              <OpenTradeRow key={t.id} trade={t} now={now} payout={state.settings.payout} onClose={() => onCloseTrade(t.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Closed history */}
      <section className="rounded-2xl border border-border bg-card p-4" aria-label="تاریخچه معاملات">
        <h2 className="text-sm font-bold">تاریخچه ({closed.length})</h2>
        {closed.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#a89d8d]">هنوز معامله‌ای بسته نشده</p>
        ) : (
          <div className="mt-2 max-h-[420px] space-y-2 overflow-y-auto pl-1">
            {closed.slice(0, 40).map(t => <ClosedTradeRow key={t.id} trade={t} />)}
          </div>
        )}
      </section>
    </div>
  )
}

function ClosedTradeRow({ trade }: { trade: Trade }) {
  const win = trade.result === 'WIN'
  const draw = trade.result === 'DRAW'
  const d = new Date(trade.openTime)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  const buy = trade.direction === 'BUY'

  return (
    <div className={`rounded-xl border border-border p-3 ${win ? 'flash-win' : draw ? '' : 'flash-loss'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-black ${buy ? 'bg-[#35c98e]/15 text-[#35c98e]' : 'bg-[#f4536b]/15 text-[#f4536b]'}`}>
            {buy ? 'خرید' : 'فروش'}
          </span>
          <span className="text-xs font-bold">XAUUSD/GOLD</span>
          {trade.stake > 0 ? <span className="text-[10px] text-[#a89d8d] tabular-nums">${trade.stake}</span> : <span className="text-[10px] text-[#a89d8d] tabular-nums">{trade.lots} لات</span>}
        </div>
        <span className={`text-sm font-black tabular-nums ${pnlClass(trade.pnl ?? 0)}`}>
          {fmtMoney(trade.pnl ?? 0, true)}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-[#a89d8d] tabular-nums">
        <span>
          {time} • {trade.openPrice.toFixed(2)} ← {trade.closePrice?.toFixed(2)}
        </span>
        <span className={win ? 'font-bold text-[#35c98e]' : draw ? '' : 'font-bold text-[#f4536b]'}>
          {win ? 'برد' : draw ? 'خنثی' : 'باخت'} — بسته‌شده در {trade.durationSec} ثانیه
        </span>
      </div>
    </div>
  )
}
