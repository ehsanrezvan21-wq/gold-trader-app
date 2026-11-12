// ─── Market simulator: XAUUSD price engine, candles & technical indicators ───
import type { Candle, Tick } from './types'

const SPREAD = 0.35 // USD spread for gold (ask - bid)
const PIP = 0.1 // gold pip = 0.1 USD

/** Random-walk price engine with momentum regimes + occasional spikes. */
export class MarketSimulator {
  price = 2654.25
  dayOpen = this.price
  high = this.price
  low = this.price
  private momentum = 0
  private regime: number = 0 // -1 down, 0 flat, +1 up
  private regimeTicks = 0

  constructor() {
    const hour = new Date().getUTCHours()
    // session-ish volatility: asia quieter, london/ny louder
    this.baseVol = 0.09 + (hour >= 7 && hour <= 20 ? 0.07 : 0)
  }

  private baseVol: number

  tick(): Tick {
    this.regimeTicks--
    if (this.regimeTicks <= 0) {
      // pick a new regime: trend persistence ~ realistic gold behavior
      const r = Math.random()
      this.regime = r < 0.38 ? (Math.random() < 0.5 ? -1 : 1) : 0
      this.regimeTicks = 30 + Math.floor(Math.random() * 90)
    }

    // momentum with mean reversion
    this.momentum = this.momentum * 0.94 + (Math.random() - 0.5) * this.baseVol * 0.9
    let drift = this.momentum + this.regime * this.baseVol * 0.22

    // rare spike (news-like)
    if (Math.random() < 0.004) {
      drift += (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 1.4)
    }

    this.price = Math.max(1000, this.price + drift)
    this.high = Math.max(this.high, this.price)
    this.low = Math.min(this.low, this.price)

    const bid = +(this.price - SPREAD / 2).toFixed(2)
    const ask = +(this.price + SPREAD / 2).toFixed(2)
    return {
      price: +this.price.toFixed(2),
      bid,
      ask,
      change: +(this.price - this.dayOpen).toFixed(2),
      changePct: +(((this.price - this.dayOpen) / this.dayOpen) * 100).toFixed(3),
      time: Date.now(),
      dayOpen: +this.dayOpen.toFixed(2),
      high: +this.high.toFixed(2),
      low: +this.low.toFixed(2),
    }
  }
}

/** Aggregates ticks into candles of `secMs` window. */
export class CandleBuilder {
  candles: Candle[] = []
  private current: Candle | null = null

  constructor(private windowMs: number, private max = 120) {}

  push(price: number, now = Date.now()) {
    const bucket = Math.floor(now / this.windowMs) * this.windowMs
    if (!this.current || this.current.t !== bucket) {
      if (this.current) {
        this.candles.push(this.current)
        if (this.candles.length > this.max) this.candles.shift()
      }
      this.current = { t: bucket, o: price, h: price, l: price, c: price }
    } else {
      this.current.h = Math.max(this.current.h, price)
      this.current.l = Math.min(this.current.l, price)
      this.current.c = price
    }
  }

  get closed(): Candle[] {
    return this.current ? [...this.candles, this.current] : this.candles
  }
}

// ─── Indicators ───
export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const out: number[] = []
  let prev = values[0]
  values.forEach((v, i) => {
    prev = i === 0 ? v : v * k + prev * (1 - k)
    out.push(prev)
  })
  return out
}

export function sma(values: number[], period: number): number[] {
  const out: number[] = []
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    out.push(i >= period - 1 ? sum / period : values[i])
  }
  return out
}

export function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gains = 0
  let losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    if (d >= 0) gains += d
    else losses -= d
  }
  if (losses === 0) return 100
  const rs = gains / losses
  return +(100 - 100 / (1 + rs)).toFixed(1)
}

export function macd(closes: number[], fast = 12, slow = 26, signalP = 9) {
  const ef = ema(closes, fast)
  const es = ema(closes, slow)
  const line = closes.map((_, i) => ef[i] - es[i])
  const sig = ema(line, signalP)
  return { line: line[line.length - 1], signal: sig[sig.length - 1], hist: line[line.length - 1] - sig[sig.length - 1] }
}

export function atr(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0.5
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    const p = candles[i - 1]
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)))
  }
  const slice = trs.slice(-period)
  return +(slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(3)
}

export function trendOf(closes: number[]): 'UP' | 'DOWN' | 'FLAT' {
  if (closes.length < 21) return 'FLAT'
  const e9 = ema(closes, 9)
  const e21 = ema(closes, 21)
  const last = e9[e9.length - 1] - e21[e21.length - 1]
  const scale = Math.max(0.02, closes[closes.length - 1] * 0.00008)
  if (last > scale) return 'UP'
  if (last < -scale) return 'DOWN'
  return 'FLAT'
}

/**
 * Kaufman Efficiency Ratio (0..1): net move divided by the sum of absolute
 * per-candle moves. High = efficient directional market, low = choppy noise.
 */
export function ker(closes: number[], period = 10): number {
  if (closes.length < period + 1) return 0.5
  const slice = closes.slice(-(period + 1))
  const net = Math.abs(slice[slice.length - 1] - slice[0])
  let path = 0
  for (let i = 1; i < slice.length; i++) path += Math.abs(slice[i] - slice[i - 1])
  if (path === 0) return 0
  return +(net / path).toFixed(3)
}

export function computeIndicators(candles: Candle[]) {
  const closes = candles.map(c => c.c)
  const m = macd(closes)
  return {
    rsi: rsi(closes),
    macd: +m.line.toFixed(3),
    macdSignal: +m.signal.toFixed(3),
    ema9: +ema(closes, 9)[closes.length - 1].toFixed(2),
    ema21: +ema(closes, 21)[closes.length - 1].toFixed(2),
    atr: atr(candles),
    trend: trendOf(closes),
    ker: ker(closes),
  }
}

export { SPREAD, PIP }
