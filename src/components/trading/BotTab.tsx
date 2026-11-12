'use client'

import type { FullState } from '@/lib/trading-types'
import { ConfidenceRing } from './ConfidenceRing'
import { TrendingUp, TrendingDown, Minus, Power, Zap, ScrollText } from 'lucide-react'

const DURATIONS = [30, 45, 60] as const

export function BotTab({
  state,
  now,
  onToggleBot,
  onSetDuration,
}: {
  state: FullState
  now: number
  onToggleBot: () => void
  onSetDuration: (s: number) => void
}) {
  const running = state.settings.botRunning
  const openCount = state.trades.filter(t => t.status === 'open').length

  return (
    <div className="space-y-3">
      {/* Power button */}
      <section className={`rounded-2xl border p-5 text-center transition-colors ${running ? 'border-[#f5b52a]/40 bg-gradient-to-b from-[#211a0e] to-[#171310] gold-glow' : 'border-border bg-card'}`} aria-label="کنترل بات">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">بات توربو</span>
          <span className={`flex items-center gap-1.5 text-[10px] ${running ? 'text-[#35c98e]' : 'text-[#a89d8d]'}`}>
            <span className={`live-dot inline-block h-1.5 w-1.5 rounded-full ${running ? 'bg-[#35c98e]' : 'bg-[#8d7b5e]'}`} />
            {running ? 'در حال معامله' : state.pausedReason ? 'متوقف' : 'غیرفعال'}
          </span>
        </div>

        <button
          onClick={onToggleBot}
          aria-pressed={running}
          aria-label={running ? 'توقف بات' : 'شروع بات'}
          className={`mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full transition-all active:scale-95 ${
            running
              ? 'bg-gradient-to-b from-[#f7d77e] to-[#f5b52a] text-[#171310] shadow-[0_0_40px_rgba(245,181,42,0.45)]'
              : 'border border-[#3a322a] bg-[#26201a] text-[#f5b52a]'
          }`}
        >
          <Power className="h-10 w-10" strokeWidth={2.5} />
        </button>

        <p className="mt-3 text-xs font-bold">{running ? 'بات فعال است — کلیک برای توقف' : 'کلیک برای شروع معامله خودکار'}</p>
        {state.pausedReason && (
          <p className="mx-auto mt-2 max-w-xs rounded-lg bg-[#f4536b]/10 px-3 py-1.5 text-[11px] leading-5 text-[#f4536b]">{state.pausedReason}</p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-black/30 p-2">
            <div className="text-[10px] text-[#a89d8d]">حجم هر معامله</div>
            <div className="text-sm font-bold tabular-nums">{state.settings.mode === 'demo' ? `$${state.settings.stake}` : `${state.settings.mt5Lots} لات`}</div>
          </div>
          <div className="rounded-xl bg-black/30 p-2">
            <div className="text-[10px] text-[#a89d8d]">معاملات باز</div>
            <div className="text-sm font-bold tabular-nums">{openCount}/{state.settings.maxConcurrent}</div>
          </div>
          <div className="rounded-xl bg-black/30 p-2">
            <div className="text-[10px] text-[#a89d8d]">حداقل اطمینان</div>
            <div className="text-sm font-bold tabular-nums">{state.settings.minConfidence}٪</div>
          </div>
        </div>
      </section>

      {/* Turbo mode panel */}
      <section className="rounded-2xl border border-border bg-card p-4" aria-label="حالت توربو">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#f5b52a]" />
          <h2 className="text-sm font-bold">حالت توربو</h2>
          <span className="text-[10px] text-[#a89d8d]">بستن خودکار معامله بعد از</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DURATIONS.map(d => (
            <button
              key={d}
              onClick={() => onSetDuration(d)}
              aria-pressed={state.settings.tradeDurationSec === d}
              className={`rounded-xl border py-2.5 text-center transition-colors ${
                state.settings.tradeDurationSec === d
                  ? 'border-[#f5b52a] bg-[#f5b52a]/10 font-black text-[#f5b52a]'
                  : 'border-border bg-black/30 text-stone-300 active:bg-black/50'
              }`}
            >
              <span className="block text-base font-black tabular-nums">{d}</span>
              <span className="text-[10px]">ثانیه</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-5 text-[#a89d8d]">
          در حالت توربو، هر معامله به‌صورت خودکار پس از زمان انتخاب‌شده بسته می‌شود. برد = {fmt(state.settings.payout)}× حجم معامله.
        </p>
      </section>

      {/* AI signals feed */}
      <section className="rounded-2xl border border-border bg-card p-4" aria-label="فید سیگنال‌ها">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">سیگنال‌های هوش مصنوعی</h2>
          <span className="text-[10px] text-[#a89d8d]">هر {state.settings.signalIntervalSec} ثانیه</span>
        </div>
        <div className="mt-3 max-h-[340px] space-y-2 overflow-y-auto pl-1" role="feed">
          {state.signals.length === 0 && <p className="py-4 text-center text-xs text-[#a89d8d]">در انتظار اولین تحلیل…</p>}
          {state.signals.slice(0, 10).map(sig => {
            const age = Math.max(0, Math.round((now - sig.time) / 1000))
            return (
              <div key={sig.id} className="rounded-xl border border-border bg-black/30 p-3">
                <div className="flex items-center gap-3">
                  <ConfidenceRing value={sig.confidence} size={46} stroke={4} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {sig.action === 'BUY' ? (
                        <span className="flex items-center gap-1 rounded-md bg-[#35c98e]/15 px-1.5 py-0.5 text-[10px] font-black text-[#35c98e]"><TrendingUp className="h-3 w-3" /> خرید</span>
                      ) : sig.action === 'SELL' ? (
                        <span className="flex items-center gap-1 rounded-md bg-[#f4536b]/15 px-1.5 py-0.5 text-[10px] font-black text-[#f4536b]"><TrendingDown className="h-3 w-3" /> فروش</span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-md bg-stone-500/15 px-1.5 py-0.5 text-[10px] font-black text-stone-300"><Minus className="h-3 w-3" /> انتظار</span>
                      )}
                      {sig.acted && <span className="rounded-md bg-[#f5b52a]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#f5b52a]">اجرا شد</span>}
                      <span className="mr-auto text-[9px] text-[#8d7b5e] tabular-nums">{age < 5 ? 'همین حالا' : `${age} ثانیه پیش`}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-[#c9bda9]">{sig.reason}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Activity log */}
      <section className="rounded-2xl border border-border bg-card p-4" aria-label="گزارش فعالیت">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-[#f5b52a]" />
          <h2 className="text-sm font-bold">گزارش فعالیت</h2>
        </div>
        <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pl-1" role="log">
          {state.logs.map(l => (
            <div key={l.id} className="flex items-start gap-2 text-[11px] leading-5">
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  l.level === 'success' ? 'bg-[#35c98e]' : l.level === 'error' ? 'bg-[#f4536b]' : l.level === 'warn' ? 'bg-[#f5b52a]' : l.level === 'ai' ? 'bg-[#e0c084]' : 'bg-[#8d7b5e]'
                }`}
              />
              <span className={l.level === 'success' ? 'text-[#35c98e]' : l.level === 'error' ? 'text-[#f4536b]' : 'text-[#c9bda9]'}>{l.message}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}
