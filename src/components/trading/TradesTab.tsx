'use client'

import type { FullState, Trade } from '@/lib/trading-types'
import { fmtMoney, pnlClass } from './HomeTab'
import { OpenTradeRow } from './HomeTab'
import { Trophy } from "lucide-react"

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

  return (
    <div className="space-y-3">
      {/* Stats */}
      <section className="rounded-2xl border border-[#3a2f1d] bg-gradient-to-b from-[#211a0e] to-[#171310] p-4" aria-label="آمار کلی">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[#f5b52a]" />
          <h2 className="text-sm font-bold">عملکرد بات</h2>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-black/30 p-2">
            <div className="text-[10px] text-[#a89d8d]">نرخ برد</div>
            <div className="text-base font-black text-[#f5b52a] tabular-nums">{s.winRate}٪</div>
          </div>
          <div className="rounded-xl bg-black/30 p-2">
            <div className="text-[10px] text-[#a89d8d]">برد</div>
            <div className="text-base font-black text-[#35c98e] tabular-nums">{s.wins}</div>
          </div>
          <div className="rounded-xl bg-black/30 p-2">
            <div className="text-[10px] text-[#a89d8d]">باخت</div>
            <div className="text-base font-black text-[#f4536b] tabular-nums">{s.losses}</div>
          </div>
          <div className="rounded-xl bg-black/30 p-2">
            <div className="text-[10px] text-[#a89d8d]">سود کل</div>
            <div className={`text-base font-black tabular-nums ${pnlClass(s.totalPnl)}`}>{fmtMoney(s.totalPnl, true)}</div>
          </div>
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
