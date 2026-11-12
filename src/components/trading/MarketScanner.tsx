'use client'

import type { AISignal, FullState, Tick } from '@/lib/trading-types'
import { SYMBOL_LIST, SYMBOL_META, fmtPx } from '@/lib/trading-types'
import { TrendingUp, TrendingDown, Minus, Radar } from 'lucide-react'

/**
 * Multi-market AI scanner: latest verdict of every market in one glance.
 * Tap a row to make that market active (chart + GLM analysis + manual trades).
 */
export function MarketScanner({ state, now, onSetSymbol }: {
  state: FullState
  now: number
  onSetSymbol?: (s: string) => void
}) {
  const { signals, symbolTicks, settings } = state

  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-label="اسکنر بازارها">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-[#f5b52a]" />
          <h2 className="text-sm font-bold">اسکنر بازارها</h2>
        </div>
        <span className="text-[10px] text-[#a89d8d]">آخرین تحلیل هر بازار</span>
      </div>

      <div className="mt-3 space-y-2">
        {SYMBOL_LIST.map(sym => {
          const sig = signals.find(s => s.symbol === sym) ?? null
          const tick: Tick | null = symbolTicks?.[sym] ?? null
          const active = sym === settings.activeSymbol
          const actionable = !!sig && sig.action !== 'HOLD' && sig.confidence >= settings.minConfidence
          return (
            <ScannerRow
              key={sym}
              symbol={sym}
              sig={sig}
              tick={tick}
              active={active}
              actionable={actionable}
              minConfidence={settings.minConfidence}
              now={now}
              onSelect={() => onSetSymbol?.(sym)}
            />
          )
        })}
      </div>
    </section>
  )
}

function ScannerRow({ symbol, sig, tick, active, actionable, minConfidence, now, onSelect }: {
  symbol: string
  sig: AISignal | null
  tick: Tick | null
  active: boolean
  actionable: boolean
  minConfidence: number
  now: number
  onSelect: () => void
}) {
  const meta = SYMBOL_META[symbol]
  const up = (tick?.change ?? 0) >= 0
  const age = sig ? Math.max(0, Math.round((now - sig.time) / 1000)) : null
  const ageLabel = age === null ? '' : age < 5 ? 'همین حالا' : age < 60 ? `${age} ثانیه پیش` : `${Math.floor(age / 60)} دقیقه پیش`

  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`نمایش بازار ${meta.fa}`}
      className={`w-full rounded-xl border p-2.5 text-right transition-colors ${
        active
          ? 'border-[#f5b52a]/60 bg-[#f5b52a]/10'
          : actionable
            ? 'border-[#f5b52a]/25 bg-black/25 active:bg-black/40'
            : 'border-border bg-black/25 active:bg-black/40'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {/* symbol identity + price */}
        <div className="w-[92px] shrink-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-black ${active ? 'text-[#f5b52a]' : ''}`}>{meta.badge}</span>
            {active && <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-[#f5b52a]" />}
          </div>
          <div className="mt-0.5 text-xs font-black tabular-nums text-stone-100" dir="ltr">
            {tick ? fmtPx(symbol, tick.price) : '—'}
          </div>
          <div className={`text-[9px] font-bold tabular-nums ${up ? 'text-[#35c98e]' : 'text-[#f4536b]'}`} dir="ltr">
            {tick ? `${up ? '+' : '−'}${Math.abs(tick.changePct).toFixed(2)}%` : ''}
          </div>
        </div>

        {/* verdict */}
        <div className="min-w-0 flex-1">
          {sig ? (
            <>
              <div className="flex items-center gap-1.5">
                {sig.action === 'BUY' ? (
                  <span className="flex items-center gap-1 rounded-md bg-[#35c98e]/15 px-1.5 py-0.5 text-[10px] font-black text-[#35c98e]">
                    <TrendingUp className="h-3 w-3" /> خرید
                  </span>
                ) : sig.action === 'SELL' ? (
                  <span className="flex items-center gap-1 rounded-md bg-[#f4536b]/15 px-1.5 py-0.5 text-[10px] font-black text-[#f4536b]">
                    <TrendingDown className="h-3 w-3" /> فروش
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-md bg-stone-500/15 px-1.5 py-0.5 text-[10px] font-black text-stone-300">
                    <Minus className="h-3 w-3" /> انتظار
                  </span>
                )}
                {actionable && (
                  <span className="rounded-md bg-[#f5b52a]/20 px-1.5 py-0.5 text-[9px] font-black text-[#f5b52a]">فرصت</span>
                )}
                <span className="mr-auto text-[9px] text-[#8d7b5e] tabular-nums">{ageLabel}</span>
              </div>
              {/* confidence bar vs threshold */}
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#2c251e]" aria-label={`اطمینان ${sig.confidence} درصد`}>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    sig.action === 'BUY' ? 'bg-gradient-to-l from-[#35c98e] to-[#7ee2bd]'
                      : sig.action === 'SELL' ? 'bg-gradient-to-l from-[#f4536b] to-[#ff8fa0]'
                        : 'bg-gradient-to-l from-[#8d7b5e] to-[#a89d8d]'
                  }`}
                  style={{ width: `${Math.min(100, sig.confidence)}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] text-[#8d7b5e] tabular-nums">
                <span>
                  RSI {sig.indicators.rsi} • {sig.indicators.trend === 'UP' ? 'روند صعودی' : sig.indicators.trend === 'DOWN' ? 'روند نزولی' : 'بی‌روند'}
                </span>
                <span className={sig.confidence >= minConfidence ? 'font-bold text-[#c9bda9]' : ''}>
                  اطمینان {sig.confidence}٪ / حد {minConfidence}٪
                </span>
              </div>
            </>
          ) : (
            <p className="text-[10px] leading-5 text-[#8d7b5e]">در انتظار اولین تحلیل این بازار…</p>
          )}
        </div>
      </div>
    </button>
  )
}
