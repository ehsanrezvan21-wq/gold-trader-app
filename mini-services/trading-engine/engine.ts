// ─── Core engine: bot loop, state, risk management, persistence ───
import fs from 'fs'
import path from 'path'
import type {
  AISignal, BotSettings, BotStats, Candle, FullState, LogEntry, Tick, Trade,
} from './types'
import { CandleBuilder, MarketSimulator, PIP, computeIndicators } from './market'
import { analyzeMarket, localVerdict } from './ai'
import { demoSettle, mt5Account, mt5Close, mt5Open, mt5Positions } from './broker'

const STATE_FILE = path.join(__dirname, 'state.json')
const SYMBOL = 'XAUUSD'
const MAX_HISTORY = 150

export const DEFAULT_SETTINGS: BotSettings = {
  stake: 10,
  payout: 1.85,
  minConfidence: 58,
  maxConcurrent: 3,
  dailyLossCap: 40,
  tradeDurationSec: 45,
  signalIntervalSec: 20,
  slPips: 30,
  tpPips: 60,
  mt5Lots: 0.01,
  mode: 'demo',
  metaapiToken: '',
  metaapiAccountId: '',
  metaapiRegion: 'new-york',
  botRunning: false,
  soundEnabled: true,
  cooldownAfterLossSec: 12,
  maxConsecutiveLosses: 3,
}

export function freshStats(): BotStats {
  return {
    wins: 0, losses: 0, totalTrades: 0, totalPnl: 0, todayTrades: 0, todayPnl: 0, winRate: 0,
    bestTrade: 0, worstTrade: 0, streak: 0, bestStreak: 0, worstStreak: 0, grossProfit: 0, grossLoss: 0,
  }
}

interface PersistState {
  settings: BotSettings
  balance: number
  dayPnl: number
  dayKey: string
  stats: BotStats
  trades: Trade[]
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function loadState(): PersistState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as PersistState
      return {
        settings: { ...DEFAULT_SETTINGS, ...s.settings, botRunning: false },
        balance: typeof s.balance === 'number' ? s.balance : 100,
        dayPnl: s.dayPnl ?? 0,
        dayKey: s.dayKey ?? todayKey(),
        // merge for migration: older state.json files lack the new stat fields
        stats: { ...freshStats(), ...(s.stats ?? {}) },
        trades: Array.isArray(s.trades) ? s.trades.slice(0, MAX_HISTORY) : [],
      }
    }
  } catch { /* corrupted state -> reset */ }
  return {
    settings: { ...DEFAULT_SETTINGS },
    balance: 100,
    dayPnl: 0,
    dayKey: todayKey(),
    stats: freshStats(),
    trades: [],
  }
}

export class TradingEngine {
  settings: BotSettings = { ...DEFAULT_SETTINGS }
  balance = 100
  dayPnl = 0
  dayKey = todayKey()
  pausedReason: string | null = null
  stats: BotStats = freshStats()
  trades: Trade[] = []
  signals: AISignal[] = []
  logs: LogEntry[] = []
  candles: Candle[] = []
  tick: Tick | null = null
  mt5: FullState['mt5'] = null
  mt5Status: FullState['mt5Status'] = 'disconnected'
  mt5Error: string | null = null

  private market = new MarketSimulator()
  private builder5s = new CandleBuilder(5000, 120)
  private builder1m = new CandleBuilder(60000, 60)
  private aiBusy = false
  private lastSignalAt = 0
  private rateBackoff = 0
  private lastGlmTryAt = 0
  private lastLossAt = 0
  private onEmit: () => void = () => {}
  private timers: NodeJS.Timeout[] = []
  private saveDebounce: NodeJS.Timeout | null = null

  constructor(onEmit: () => void) {
    this.onEmit = onEmit
    const persisted = loadState()
    this.settings = persisted.settings
    this.balance = persisted.balance
    this.dayPnl = persisted.dayPnl
    this.dayKey = persisted.dayKey
    this.stats = persisted.stats
    this.trades = persisted.trades
    if (this.dayKey !== todayKey()) this.resetDay()

    // prefill market history so the chart is alive from first paint
    let t = Date.now() - 120 * 5000
    for (let i = 0; i < 240; i++) {
      const tick = this.market.tick()
      this.builder5s.push(tick.price, t)
      this.builder1m.push(tick.price, t)
      t += 2500
    }
    this.candles = this.builder5s.closed
    this.log('info', 'موتور ترید راه‌اندازی شد — آماده کار روی XAUUSD (طلا)')
  }

  start() {
    // price tick + candle aggregation every 1s
    this.timers.push(setInterval(() => this.onTick(), 1000))
    // AI analysis cycle
    this.timers.push(setInterval(() => this.aiCycle(), 1500))
    // MT5 account refresh
    this.timers.push(setInterval(() => this.mt5Refresh(), 20000))
    if (this.settings.mode === 'mt5') this.mt5Status = 'connecting'
  }

  stop() {
    this.timers.forEach(clearInterval)
    this.timers = []
    this.saveNow()
  }

  // ─── public API for socket handlers ───
  updateSettings(patch: Partial<BotSettings>) {
    const prevMode = this.settings.mode
    this.settings = { ...this.settings, ...patch }
    if (this.settings.mode !== prevMode) {
      this.mt5Error = null
      this.mt5Status = this.settings.mode === 'mt5' ? 'connecting' : 'disconnected'
      if (this.settings.mode === 'mt5') {
        this.log('info', 'حالت MT5 واقعی فعال شد — در حال اتصال به حساب…')
        this.mt5Refresh()
      } else {
        this.mt5 = null
        this.log('info', 'به حالت دمو برگشتید')
      }
    }
    if (patch.botRunning !== undefined) {
      if (patch.botRunning) {
        this.pausedReason = null
        this.log('success', 'بات فعال شد — حالت توربو در جریان است')
      } else this.log('warn', 'بات متوقف شد')
    }
    this.save()
    this.onEmit()
  }

  resetAccount() {
    this.balance = 100
    this.dayPnl = 0
    this.resetDay()
    this.stats = freshStats()
    this.trades = []
    this.signals = []
    this.logs = []
    this.lastLossAt = 0
    this.log('info', 'حساب دمو ریست شد — موجودی: $100')
    this.save()
    this.onEmit()
  }

  closeTradeManually(id: string) {
    const trade = this.trades.find(t => t.id === id && t.status === 'open')
    if (!trade) return
    if (this.settings.mode === 'mt5' && trade.positionId) {
      this.settleMt5(trade, true)
    } else {
      this.settleDemo(trade, this.tick?.price ?? trade.openPrice)
    }
  }

  /** Manual BUY/SELL from the user, bypassing the AI confidence gate and the post-loss cooldown. */
  openManualTrade(direction: 'BUY' | 'SELL'): { ok: boolean; reason?: string } {
    const check = this.canOpen()
    if (!check.ok) {
      this.log('warn', `معامله دستی رد شد — ${check.reason}`)
      this.onEmit()
      return { ok: false, reason: check.reason }
    }
    const r = this.tryOpenTrade(direction, 100, 'معامله دستی کاربر', 'MANUAL', true)
    if (r.ok) {
      this.log('success', `معامله دستی ${direction === 'BUY' ? 'خرید' : 'فروش'} XAUUSD باز شد — بستن خودکار در ${this.settings.tradeDurationSec} ثانیه`)
    }
    this.onEmit()
    return { ok: r.ok, reason: r.ok ? undefined : r.reason }
  }

  // ─── internals ───
  private resetDay() {
    this.dayKey = todayKey()
    this.dayPnl = 0
    this.stats.todayTrades = 0
    this.stats.todayPnl = 0
    this.pausedReason = null
    this.market.dayOpen = this.market.price
  }

  private log(level: LogEntry['level'], message: string) {
    this.logs.unshift({ id: Math.random().toString(36).slice(2), time: Date.now(), level, message })
    if (this.logs.length > 60) this.logs.pop()
  }

  private save() {
    if (this.saveDebounce) return
    this.saveDebounce = setTimeout(() => {
      this.saveDebounce = null
      this.saveNow()
    }, 1500)
  }

  private saveNow() {
    try {
      const data: PersistState = {
        settings: this.settings,
        balance: this.balance,
        dayPnl: this.dayPnl,
        dayKey: this.dayKey,
        stats: this.stats,
        trades: this.trades.slice(0, MAX_HISTORY),
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(data))
    } catch { /* best effort */ }
  }

  private emitTick() {
    const tick = this.market.tick()
    this.builder5s.push(tick.price)
    this.builder1m.push(tick.price)
    this.candles = this.builder5s.closed
    this.tick = tick
  }

  private onTick() {
    if (this.dayKey !== todayKey()) {
      this.resetDay()
      this.log('info', 'روز معاملاتی جدید — آمار روزانه صفر شد')
    }
    this.emitTick()

    // settle due turbo trades
    const now = Date.now()
    for (const trade of this.trades.filter(t => t.status === 'open')) {
      if (trade.mode === 'demo' && now >= trade.closeTime) {
        this.settleDemo(trade, this.tick?.price ?? trade.openPrice)
      } else if (trade.mode === 'mt5' && trade.positionId && now >= trade.closeTime) {
        this.settleMt5(trade, false)
      }
    }

    // MT5 open trades: update current PnL into equity
    this.onEmit()
  }

  private async aiCycle() {
    if (this.aiBusy) return
    // technical analysis always runs at full turbo cadence; only the GLM call
    // is throttled separately by its own rate-limit backoff
    if (Date.now() - this.lastSignalAt < this.settings.signalIntervalSec * 1000) return
    this.aiBusy = true
    try {
      const candles = this.builder1m.closed.slice(-40)
      const glmReady = Date.now() - this.lastGlmTryAt >= this.rateBackoff * 1000
      if (glmReady) {
        this.lastGlmTryAt = Date.now()
        try {
          const verdict = await analyzeMarket(candles)
          this.rateBackoff = 0
          // If GLM hesitates (HOLD) but technicals clearly lean one way, follow the technical signal
          let final = verdict
          if (verdict.action === 'HOLD') {
            const local = localVerdict(candles)
            if (local.action !== 'HOLD' && local.confidence >= 60) {
              final = { ...local, reason: `${local.reason} — تأیید تکنیکال` }
            }
          }
          this.applyVerdict(final, 'AI')
          return
        } catch (e: any) {
          const msg = String(e?.message || 'نامشخص')
          const rateLimited = msg.includes('429') || msg.toLowerCase().includes('too many')
          if (rateLimited) {
            // exponential backoff up to 120s — for the GLM call only
            this.rateBackoff = Math.min((this.rateBackoff || 15) * 1.6, 120)
          }
          this.log('info', `AI در دسترس نیست (${rateLimited ? 'محدودیت نرخ' : 'خطا'}) — ادامه با تحلیل تکنیکال`)
        }
      }
      // GLM cooling down or failed: keep the turbo loop alive with technicals
      try {
        const verdict = localVerdict(candles)
        this.applyVerdict(verdict, 'تکنیکال')
      } catch (e: any) {
        this.log('error', `خطای تحلیل تکنیکال: ${e?.message || 'نامشخص'}`)
      }
    } finally {
      this.aiBusy = false
      this.lastSignalAt = Date.now()
      this.onEmit()
    }
  }

  private applyVerdict(verdict: { action: 'BUY' | 'SELL' | 'HOLD'; confidence: number; reason: string; indicators: ReturnType<typeof computeIndicators> }, source: 'AI' | 'تکنیکال') {
    const price = this.tick?.price ?? this.market.price

    let acted = false
    let actedTrade: Trade | null = null
    let blockedReason: string | undefined
    if (verdict.action !== 'HOLD' && verdict.confidence >= this.settings.minConfidence && this.settings.botRunning) {
      const r = this.tryOpenTrade(verdict.action as 'BUY' | 'SELL', verdict.confidence, verdict.reason)
      acted = r.ok
      actedTrade = r.trade ?? null
      blockedReason = r.reason
    }

    const signal: AISignal = {
      id: Math.random().toString(36).slice(2),
      time: Date.now(),
      action: verdict.action,
      confidence: verdict.confidence,
      reason: verdict.reason,
      price,
      indicators: verdict.indicators,
      acted,
    }
    this.signals.unshift(signal)
    if (this.signals.length > 30) this.signals.pop()

    const label = source === 'AI' ? 'AI' : 'تحلیل تکنیکال (AI موقتاً در دسترس نیست)'
    const tag = verdict.action === 'HOLD' ? '' : acted
      ? ' → معامله باز شد'
      : verdict.confidence >= this.settings.minConfidence
        ? ` (${blockedReason || 'بات غیرفعال یا ظرفیت تکمیل'})`
        : ` (زیر حد اطمینان ${this.settings.minConfidence}%)`
    this.log(source === 'AI' ? 'ai' : 'info', `${label}: ${verdict.action === 'BUY' ? 'خرید' : verdict.action === 'SELL' ? 'فروش' : 'انتظار'} — اطمینان ${verdict.confidence}٪ — ${verdict.reason}${tag}`)
    if (actedTrade) this.log('success', `معامله ${verdict.action === 'BUY' ? 'خرید' : 'فروش'} XAUUSD با حجم $${actedTrade.stake} باز شد — هدف: ${actedTrade.durationSec} ثانیه`)
  }

  private canOpen(includeCooldown = false): { ok: boolean; reason?: string } {
    if (this.pausedReason) return { ok: false, reason: this.pausedReason }
    if (this.dayPnl <= -this.settings.dailyLossCap) {
      this.pausedReason = `سقف ضرر روزانه (${this.settings.dailyLossCap}$) لمس شد — بات متوقف است`
      this.settings.botRunning = false
      this.log('warn', this.pausedReason)
      return { ok: false, reason: this.pausedReason }
    }
    // post-loss cooldown: prevents revenge-trading cascades right after a loss
    if (includeCooldown && this.lastLossAt > 0) {
      const waitMs = this.settings.cooldownAfterLossSec * 1000
      const elapsed = Date.now() - this.lastLossAt
      if (elapsed < waitMs) {
        return { ok: false, reason: `استراحت بعد از باخت — ${Math.ceil((waitMs - elapsed) / 1000)} ثانیه تا معامله بعدی` }
      }
    }
    const openCount = this.trades.filter(t => t.status === 'open').length
    if (openCount >= this.settings.maxConcurrent) return { ok: false, reason: 'ظرفیت معاملات همزمان تکمیل است' }
    if (this.settings.mode === 'demo' && this.balance < this.settings.stake) {
      this.pausedReason = 'موجودی کافی نیست'
      return { ok: false, reason: this.pausedReason }
    }
    return { ok: true }
  }

  private tryOpenTrade(direction: 'BUY' | 'SELL', confidence: number, reason: string, comment?: string, skipCooldown = false): { ok: boolean; reason?: string; trade?: Trade } {
    const check = this.canOpen(!skipCooldown)
    if (!check.ok) return { ok: false, reason: check.reason }
    const now = Date.now()
    const base: Omit<Trade, 'openPrice' | 'mode' | 'positionId' | 'lots' | 'stake'> = {
      id: Math.random().toString(36).slice(2),
      symbol: SYMBOL,
      direction,
      openTime: now,
      closeTime: now + this.settings.tradeDurationSec * 1000,
      durationSec: this.settings.tradeDurationSec,
      status: 'open',
      confidence,
      aiReason: reason,
      comment: comment ?? `AI ${confidence}%`,
    }

    if (this.settings.mode === 'demo') {
      const trade: Trade = { ...base, mode: 'demo', stake: this.settings.stake, lots: 0, openPrice: this.tick?.price ?? this.market.price }
      this.trades.unshift(trade)
      if (this.trades.length > MAX_HISTORY) this.trades.pop()
      this.save()
      return { ok: true, trade }
    }

    // MT5 real mode
    const trade: Trade = { ...base, mode: 'mt5', stake: 0, lots: this.settings.mt5Lots, openPrice: this.tick?.price ?? this.market.price }
    // optimistic insert; confirm with API
    this.trades.unshift(trade)
    if (this.trades.length > MAX_HISTORY) this.trades.pop()
    mt5Open(this.settings, direction, base.comment)
      .then(res => {
        if (res.ok) {
          trade.positionId = res.positionId
          trade.openPrice = res.openPrice ?? trade.openPrice
          this.log('success', `سفارش واقعی ${direction} روی MT5 ثبت شد (حجم ${this.settings.mt5Lots} لات)`)
        } else {
          trade.status = 'closed'
          trade.result = 'DRAW'
          trade.pnl = 0
          this.log('error', res.error || 'ثبت سفارش MT5 ناموفق بود')
        }
        this.save()
        this.onEmit()
      })
    return { ok: true, trade }
  }

  private settleDemo(trade: Trade, closePrice: number) {
    trade.status = 'closed'
    trade.closePrice = +closePrice.toFixed(2)
    const result = demoSettle(trade.direction, trade.openPrice, trade.closePrice)
    trade.result = result
    trade.pnl = result === 'WIN' ? +(trade.stake * this.settings.payout).toFixed(2)
      : result === 'LOSS' ? -trade.stake : 0
    this.balance = +(this.balance + (trade.pnl ?? 0)).toFixed(2)
    this.applyTradeResult(trade)
    this.log(result === 'WIN' ? 'success' : 'warn',
      `معامله ${result === 'WIN' ? 'برد ✚' : 'باخت ✖'} — ${trade.direction} XAUUSD — سود/زیان: ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl} (بسته شده در ${trade.durationSec} ثانیه)`)
    if (result === 'LOSS' && this.settings.cooldownAfterLossSec > 0) {
      this.log('info', `استراحت ${this.settings.cooldownAfterLossSec} ثانیه‌ای بعد از باخت فعال شد`)
    }
  }

  private async settleMt5(trade: Trade, manual: boolean) {
    if (!trade.positionId) return
    const res = await mt5Close(this.settings, trade.positionId)
    if (!res.ok) {
      this.log('error', res.error || 'بستن پوزیشن ناموفق بود')
      return
    }
    // fetch actual profit from positions history via account info refresh
    trade.status = 'closed'
    trade.closeTime = Date.now()
    const acct = await mt5Account(this.settings)
    const pnl = typeof res.pnl === 'number' ? res.pnl : 0
    trade.pnl = +pnl.toFixed(2)
    trade.result = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'DRAW'
    if (acct.ok && acct.info) {
      this.mt5 = acct.info
      this.balance = acct.info.balance
    } else {
      this.balance = +(this.balance + pnl).toFixed(2)
    }
    this.applyTradeResult(trade)
    this.log(pnl >= 0 ? 'success' : 'warn', `پوزیشن MT5 ${manual ? 'دستی ' : ''}بسته شد — سود/زیان: ${pnl >= 0 ? '+' : ''}$${trade.pnl}`)
  }

  private applyTradeResult(trade: Trade) {
    this.stats.totalTrades++
    this.stats.totalPnl = +(this.stats.totalPnl + (trade.pnl ?? 0)).toFixed(2)
    this.stats.todayTrades++
    this.stats.todayPnl = +(this.stats.todayPnl + (trade.pnl ?? 0)).toFixed(2)
    this.dayPnl = +(this.dayPnl + (trade.pnl ?? 0)).toFixed(2)
    if (trade.result === 'WIN') this.stats.wins++
    else if (trade.result === 'LOSS') this.stats.losses++
    this.stats.winRate = this.stats.wins + this.stats.losses > 0
      ? Math.round((this.stats.wins / (this.stats.wins + this.stats.losses)) * 100)
      : 0

    // deep stats: best/worst trade, streaks, gross pnl (profit factor)
    const pnl = trade.pnl ?? 0
    if (pnl > this.stats.bestTrade) this.stats.bestTrade = pnl
    if (pnl < this.stats.worstTrade) this.stats.worstTrade = pnl
    if (pnl > 0) {
      this.stats.grossProfit = +(this.stats.grossProfit + pnl).toFixed(2)
      this.stats.streak = this.stats.streak > 0 ? this.stats.streak + 1 : 1
      if (this.stats.streak > this.stats.bestStreak) this.stats.bestStreak = this.stats.streak
    } else if (pnl < 0) {
      this.stats.grossLoss = +(this.stats.grossLoss + pnl).toFixed(2)
      this.stats.streak = this.stats.streak < 0 ? this.stats.streak - 1 : -1
      if (this.stats.streak < this.stats.worstStreak) this.stats.worstStreak = this.stats.streak
    }

    // timestamps for the post-loss cooldown
    if (trade.result === 'LOSS') this.lastLossAt = Date.now()

    // circuit breaker: pause after N consecutive losses
    const limit = this.settings.maxConsecutiveLosses
    if (trade.result === 'LOSS' && limit > 0 && this.stats.streak <= -limit) {
      this.pausedReason = `${limit} باخت متوالی — بات برای محافظت از سرمایه متوقف شد`
      this.settings.botRunning = false
      this.log('warn', `${this.pausedReason} — پس از استراحت می‌توانید دوباره روشن کنید`)
    }

    this.save()
  }

  private mt5Refreshing = false
  private async mt5Refresh() {
    if (this.settings.mode !== 'mt5' || this.mt5Refreshing) return
    if (!this.settings.metaapiToken || !this.settings.metaapiAccountId) {
      this.mt5Status = 'error'
      this.mt5Error = 'توکن یا شناسه حساب MetaApi وارد نشده — در تنظیمات تکمیل کنید'
      return
    }
    this.mt5Refreshing = true
    try {
      const res = await mt5Account(this.settings)
      if (res.ok && res.info) {
        this.mt5 = res.info
        this.mt5Status = 'connected'
        this.mt5Error = null
        this.balance = res.info.balance
        if (!this.mt5ConnectedLogged) {
          this.log('success', `اتصال MT5 برقرار شد — ${res.info.server} (${res.info.broker})`)
          this.mt5ConnectedLogged = true
        }
      } else {
        this.mt5Status = 'error'
        this.mt5Error = res.error || 'اتصال ناموفق'
      }
      // update live PnL of open MT5 trades
      if (this.mt5Status === 'connected') {
        const pos = await mt5Positions(this.settings)
        if (pos.ok && Array.isArray(pos.positions)) {
          for (const t of this.trades.filter(t => t.status === 'open' && t.mode === 'mt5')) {
            const p: any = pos.positions.find((x: any) => String(x.id) === t.positionId)
            if (p) t.pnl = +Number(p.profit ?? 0).toFixed(2)
          }
        }
      }
    } finally {
      this.mt5Refreshing = false
      this.onEmit()
    }
  }

  private mt5ConnectedLogged = false

  snapshot(): FullState {
    const openTrades = this.trades.filter(t => t.status === 'open')
    const floating = openTrades.reduce((s, t) => s + (t.pnl && t.status === 'open' ? t.pnl : 0), 0)
    return {
      settings: this.settings,
      balance: this.balance,
      equity: +(this.balance + floating).toFixed(2),
      dayPnl: this.dayPnl,
      pausedReason: this.pausedReason,
      stats: this.stats,
      trades: this.trades,
      signals: this.signals,
      logs: this.logs,
      candles: this.candles,
      tick: this.tick,
      mt5: this.mt5,
      mt5Status: this.settings.mode === 'demo' ? 'disconnected' : this.mt5Status,
      mt5Error: this.mt5Error,
    }
  }
}

export { SYMBOL, PIP, computeIndicators }
