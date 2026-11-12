'use client'

import type { FullState, Tick } from '@/lib/trading-types'
import { SYMBOL_LIST, SYMBOL_META, fmtPx, symbolFa } from '@/lib/trading-types'
import { CandleChart } from './CandleChart'
import { ConfidenceRing } from './ConfidenceRing'
import { TrendingUp, TrendingDown, Minus, Clock, Flame, Hand } from 'lucide-react'

export function fmtMoney(n: number, sign = false) {
  const abs = Math.abs(n)
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (sign) return `${n >= 0 ? '+' : '−'}$${s}`
  return n < 0 ? `−$${s}` : `$${s}`
}

export function pnlClass(n: number) {
  return n > 0 ? 'text-[#35c98e]' : n < 0 ? 'text-[#f4536b]' : 'text-stone-400'
}

function SymbolChip({ symbol, tick, active, onSelect }: { symbol: string; tick: Tick | null; active: boolean; onSelect: (s: string) => void }) {
  const meta = SYMBOL_META[symbol]
  const up = (tick?.change ?? 0) >= 0
  return (
    <button
      onClick={() => onSelect(symbol)}
      aria-pressed={active}
      aria-label={`انتخاب بازار ${meta.fa}`}
      className={`flex-1 rounded-xl border p-2 text-center transition-colors ${
        active
          ? 'border-[#f5b52a]/60 bg-[#f5b52a]/10'
          : 'border-border bg-black/25 active:bg-black/40'
      }`}
    >
      <div className="flex items-center justify-center gap-1">
        <span className={`text-[10px] font-bold ${active ? 'text-[#f5b52a]' : 'text-[#a89d8d]'}`}>{meta.badge}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${tick ? 'bg-[#35c98e] live-dot' : 'bg-stone-600'}`} />
      </div>
      <div className="mt-0.5 text-xs font-black tabular-nums" dir="ltr">
        {tick ? fmtPx(symbol, tick.price) : '—'}
      </div>
      <div className={`text-[9px] font-bold tabular-nums ${up ? 'text-[#35c98e]' : 'text-[#f4536b]'}`} dir="ltr">
        {tick ? `${up ? '+' : '−'}${Math.abs(tick.changePct).toFixed(2)}%` : ''}
      </div>
    </button>
  )
}

export function HomeTab({ state, tick, now, onManualTrade, onSetSymbol }: {
  state: FullState
  tick: Tick | null
  now: number
  onManualTrade?: (d: 'BUY' | 'SELL', symbol: string) => void
  onSetSymbol?: (s: string) => void
}) {
  const open = state.trades.filter(t => t.status === 'open')
  const lastSig = state.signals.find(s => s.indicators) // latest signal of any market
  const activeSymbol = state.settings.activeSymbol
  const capacityFull = open.length >= state.settings.maxConcurrent

  return (
    <div className="space-y-3">
      {/* Balance hero */}
      <section className="rounded-2xl border border-[#3a2f1d] bg-gradient-to-b from-[#211a0e] to-[#171310] p-4 gold-glow" aria-label="موجودی حساب">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#a89d8d]">موجودی حساب {state.settings.mode === 'mt5' ? 'MT5' : 'دمو'}</span>
          <span className="flex items-center gap-1.5 text-[10px] text-[#a89d8d]">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-[#35c98e]" />
            ترید زنده
          </span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="gold-text text-4xl font-black tabular-nums tracking-tight">{fmtMoney(state.balance)}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-black/30 p-2">
            <div className="text-[10px] text-[#a89d8d]">ارزش خالص</div>
            <div className="text-sm font-bold tabular-nums">{fmtMoney(state.equity)}</div>
          </div>
          <div className="rounded-xl bg-black/30 p-2">
            <div className="text-[10px] text-[#a89d8d]">سود/زیان امروز</div>
            <div className={`text-sm font-bold tabular-nums ${pnlClass(state.dayPnl)}`}>{fmtMoney(state.dayPnl, true)}</div>
          </div>
          <div className="rounded-xl bg-black/30 p-2">
            <div className="text-[10px] text-[#a89d8d]">معامله‌های باز</div>
            <div className="text-sm font-bold tabular-nums">{open.length}</div>
          </div>
        </div>
      </section>

      {/* Symbol selector */}
      <section aria-label="انتخاب بازار" className="rounded-2xl border border-border bg-card p-2.5">
        <div className="flex gap-2">
          {SYMBOL_LIST.map(sym => (
            <SymbolChip
              key={sym}
              symbol={sym}
              tick={state.symbolTicks?.[sym] ?? null}
              active={sym === activeSymbol}
              onSelect={s => onSetSymbol?.(s)}
            />
          ))}
        </div>
      </section>

      {/* Live price + chart of the active symbol */}
      <section className="rounded-2xl border border-border bg-card p-4" aria-label={`قیمت زنده ${symbolFa(activeSymbol)}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" dir="ltr">{activeSymbol}</span>
              <span className="rounded-md bg-[#f5b52a]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#f5b52a]">{symbolFa(activeSymbol)}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black tabular-nums" dir="ltr">{tick ? fmtPx(activeSymbol, tick.price) : '—'}</span>
              <span className={`text-xs font-bold tabular-nums ${tick && tick.change >= 0 ? 'text-[#35c98e]' : 'text-[#f4536b]'}`}>
                {tick ? `${tick.change >= 0 ? '+' : '−'}${Math.abs(tick.change).toFixed(activeSymbol === 'EURUSD' ? 5 : 2)} (${tick.changePct.toFixed(2)}٪)` : ''}
              </span>
            </div>
          </div>
          <div className="text-left text-[10px] text-[#a89d8d] tabular-nums">
            <div>بالاترین: {tick ? fmtPx(activeSymbol, tick.high) : '—'}</div>
            <div>پایین‌ترین: {tick ? fmtPx(activeSymbol, tick.low) : '—'}</div>
          </div>
        </div>
        <div className="mt-2">
          <CandleChart candles={state.candles} />
        </div>
      </section>

      {/* Latest AI signal */}
      <section className="rounded-2xl border border-border bg-card p-4" aria-label="آخرین سیگنال هوش مصنوعی">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">آخرین تحلیل هوش مصنوعی</h2>
          <span className="rounded-md bg-[#f5b52a]/10 px-2 py-0.5 text-[10px] text-[#f5b52a]">مدل GLM</span>
        </div>
        {lastSig ? (
          <div className="mt-3 flex items-center gap-3">
            <ConfidenceRing value={lastSig.confidence} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {lastSig.action === 'BUY' ? (
                  <span className="flex items-center gap-1 rounded-lg bg-[#35c98e]/15 px-2 py-0.5 text-xs font-black text-[#35c98e]"><TrendingUp className="h-3.5 w-3.5" /> خرید</span>
                ) : lastSig.action === 'SELL' ? (
                  <span className="flex items-center gap-1 rounded-lg bg-[#f4536b]/15 px-2 py-0.5 text-xs font-black text-[#f4536b]"><TrendingDown className="h-3.5 w-3.5" /> فروش</span>
                ) : (
                  <span className="flex items-center gap-1 rounded-lg bg-stone-500/15 px-2 py-0.5 text-xs font-black text-stone-300"><Minus className="h-3.5 w-3.5" /> انتظار</span>
                )}
                <span className="text-[10px] text-[#a89d8d] tabular-nums" dir="ltr">@ {fmtPx(activeSymbol, lastSig.price)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#c9bda9]">{lastSig.reason}</p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-[#a89d8d]">اولین تحلیل در چند ثانیه آینده نمایش داده می‌شود…</p>
        )}
      </section>

      {/* Manual trade */}
      <section className="rounded-2xl border border-border bg-card p-4" aria-label="معامله دستی">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hand className="h-4 w-4 text-[#f5b52a]" />
            <h2 className="text-sm font-bold">معامله دستی — {symbolFa(activeSymbol)}</h2>
          </div>
          <span className="text-[10px] text-[#a89d8d] tabular-nums">حجم: {state.settings.mode === 'demo' ? `$${state.settings.stake}` : `${state.settings.mt5Lots} لات`}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => onManualTrade?.('BUY', activeSymbol)}
            disabled={capacityFull}
            className={`flex flex-col items-center gap-0.5 rounded-xl border py-3 transition-colors ${
              capacityFull
                ? 'border-border bg-black/20 text-stone-600'
                : 'border-[#35c98e]/40 bg-[#35c98e]/10 text-[#35c98e] active:bg-[#35c98e]/25'
            }`}
            aria-label={`خرید دستی ${symbolFa(activeSymbol)}`}
          >
            <span className="flex items-center gap-1 text-sm font-black"><TrendingUp className="h-4 w-4" /> خرید</span>
            <span className="text-[9px] tabular-nums" dir="ltr">ASK {tick ? fmtPx(activeSymbol, tick.ask) : '—'}</span>
          </button>
          <button
            onClick={() => onManualTrade?.('SELL', activeSymbol)}
            disabled={capacityFull}
            className={`flex flex-col items-center gap-0.5 rounded-xl border py-3 transition-colors ${
              capacityFull
                ? 'border-border bg-black/20 text-stone-600'
                : 'border-[#f4536b]/40 bg-[#f4536b]/10 text-[#f4536b] active:bg-[#f4536b]/25'
            }`}
            aria-label={`فروش دستی ${symbolFa(activeSymbol)}`}
          >
            <span className="flex items-center gap-1 text-sm font-black"><TrendingDown className="h-4 w-4" /> فروش</span>
            <span className="text-[9px] tabular-nums" dir="ltr">BID {tick ? fmtPx(activeSymbol, tick.bid) : '—'}</span>
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-5 text-[#a89d8d]">معامله دستی بدون نیاز به سیگنال AI باز می‌شود و بعد از زمان توربو خودکار بسته می‌شود.</p>
      </section>

      {/* Open trades mini */}
      <section className="rounded-2xl border border-border bg-card p-4" aria-label="معامله‌های باز">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">معامله‌های باز</h2>
          {open.length > 0 && <span className="text-[10px] text-[#a89d8d] tabular-nums">{open.length} از {state.settings.maxConcurrent}</span>}
        </div>
        {open.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-1 py-4 text-center">
            <Flame className="h-5 w-5 text-[#8d7b5e]" />
            <p className="text-xs text-[#a89d8d]">معامله بازی نیست — بات را از تب «بات» روشن کنید</p>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {open.slice(0, 3).map(t => <OpenTradeRow key={t.id} trade={t} now={now} payout={state.settings.payout} />)}
          </div>
        )}
      </section>
    </div>
  )
}

export function OpenTradeRow({ trade, now, payout, onClose }: { trade: FullState['trades'][number]; now: number; payout: number; onClose?: () => void }) {
  const remainMs = Math.max(0, trade.closeTime - now)
  const totalMs = trade.durationSec * 1000
  const pct = 100 - (remainMs / totalMs) * 100
  const secLeft = Math.ceil(remainMs / 1000)
  const buy = trade.direction === 'BUY'

  return (
    <div className="rounded-xl border border-border bg-black/30 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-black ${buy ? 'bg-[#35c98e]/15 text-[#35c98e]' : 'bg-[#f4536b]/15 text-[#f4536b]'}`}>
            {buy ? 'خرید' : 'فروش'}
          </span>
          <span className="text-xs font-bold">{symbolFa(trade.symbol)}</span>
          {trade.stake > 0 ? <span className="text-[10px] text-[#a89d8d] tabular-nums">${trade.stake}</span> : <span className="text-[10px] text-[#a89d8d] tabular-nums">{trade.lots} لات</span>}
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg bg-[#f4536b]/15 px-2 py-1 text-[10px] font-bold text-[#f4536b] active:bg-[#f4536b]/30"
              aria-label="بستن معامله"
            >
              بستن
            </button>
          )}
          <div className="flex items-center gap-1 text-[10px] text-[#a89d8d] tabular-nums">
            <Clock className="h-3 w-3" />
            {secLeft} ثانیه
          </div>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#2c251e]">
        <div className="h-full rounded-full bg-gradient-to-l from-[#f7d77e] to-[#f5b52a] transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-[#a89d8d] tabular-nums">
        <span dir="ltr">ورود: {fmtPx(trade.symbol, trade.openPrice)}</span>
        <span>{trade.comment === 'MANUAL' ? 'معامله دستی' : `اطمینان: ${trade.confidence}٪`}</span>
      </div>
    </div>
  )
}
