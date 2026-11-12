// ─── Shared types for the AI Gold Turbo-Trading engine ───

export type Direction = 'BUY' | 'SELL'
export type TradeStatus = 'open' | 'closed'
export type TradeResult = 'WIN' | 'LOSS' | 'DRAW'
export type BotMode = 'demo' | 'mt5'
export type SignalAction = 'BUY' | 'SELL' | 'HOLD'

export interface BotSettings {
  /** stake per trade in USD (demo binary-style) */
  stake: number
  /** win payout multiplier in demo mode, e.g. 1.85 => win pays stake*1.85 */
  payout: number
  /** minimum AI confidence (%) to open a trade */
  minConfidence: number
  /** max simultaneous open trades */
  maxConcurrent: number
  /** daily loss cap in USD; bot auto-pauses when hit */
  dailyLossCap: number
  /** turbo trade duration in seconds */
  tradeDurationSec: number
  /** seconds between AI analysis cycles */
  signalIntervalSec: number
  /** stop loss in pips (MT5 mode) */
  slPips: number
  /** take profit in pips (MT5 mode) */
  tpPips: number
  /** lots for MT5 mode */
  mt5Lots: number
  /** demo or mt5 */
  mode: BotMode
  /** MetaApi personal token (only for mt5 mode) */
  metaapiToken: string
  /** MetaApi account id */
  metaapiAccountId: string
  /** MetaApi region, e.g. new-york */
  metaapiRegion: string
  /** is the auto-bot enabled */
  botRunning: boolean
  /** play sounds / vibration on trade events */
  soundEnabled: boolean
  /** rest period (seconds) after a LOSS before the bot may trade again */
  cooldownAfterLossSec: number
  /** pause the bot automatically after N consecutive losses */
  maxConsecutiveLosses: number
  /** symbol currently shown in the UI & targeted by GLM analysis + manual trades */
  activeSymbol: string
}

export interface Trade {
  id: string
  symbol: string
  direction: Direction
  /** stake in USD (demo) */
  stake: number
  /** lots (mt5) */
  lots: number
  openPrice: number
  openTime: number
  /** scheduled close time (turbo expiry), epoch ms */
  closeTime: number
  durationSec: number
  status: TradeStatus
  closePrice?: number
  pnl?: number
  result?: TradeResult
  confidence: number
  aiReason: string
  /** where the trade executed */
  mode: BotMode
  /** MT5 position id when mode=mt5 */
  positionId?: string
  comment: string
}

export interface AISignal {
  id: string
  time: number
  symbol: string
  action: SignalAction
  confidence: number
  reason: string
  price: number
  indicators: {
    rsi: number
    macd: number
    macdSignal: number
    ema9: number
    ema21: number
    atr: number
    trend: 'UP' | 'DOWN' | 'FLAT'
    /** Kaufman Efficiency Ratio 0..1 — low = choppy/noisy market */
    ker: number
  }
  acted: boolean
}

export interface Candle {
  t: number
  o: number
  h: number
  l: number
  c: number
}

export interface Tick {
  price: number
  bid: number
  ask: number
  changePct: number
  change: number
  time: number
  dayOpen: number
  high: number
  low: number
}

export interface BotStats {
  wins: number
  losses: number
  totalTrades: number
  totalPnl: number
  todayTrades: number
  todayPnl: number
  winRate: number
  /** biggest single win in USD (positive) */
  bestTrade: number
  /** biggest single loss in USD (negative) */
  worstTrade: number
  /** current streak: +n = n wins in a row, -n = n losses in a row */
  streak: number
  /** longest win streak */
  bestStreak: number
  /** longest loss streak (negative) */
  worstStreak: number
  /** sum of all winning pnl (for profit factor) */
  grossProfit: number
  /** sum of all losing pnl, negative (for profit factor) */
  grossLoss: number
}

export interface LogEntry {
  id: string
  time: number
  level: 'info' | 'success' | 'warn' | 'error' | 'ai'
  message: string
}

export interface MT5AccountInfo {
  broker: string
  currency: string
  balance: number
  equity: number
  marginFree: number
  server: string
}

export interface FullState {
  settings: BotSettings
  balance: number
  equity: number
  dayPnl: number
  pausedReason: string | null
  stats: BotStats
  trades: Trade[]
  signals: AISignal[]
  logs: LogEntry[]
  /** candles of the active symbol */
  candles: Candle[]
  /** tick of the active symbol */
  tick: Tick | null
  /** latest tick of every symbol (for the symbol chips) */
  symbolTicks: Record<string, Tick | null>
  mt5: MT5AccountInfo | null
  mt5Status: 'disconnected' | 'connecting' | 'connected' | 'error'
  mt5Error: string | null
}
