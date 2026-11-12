// ─── Client-side shared types (mirror of engine types) ───
export type Direction = 'BUY' | 'SELL'
export type TradeStatus = 'open' | 'closed'
export type TradeResult = 'WIN' | 'LOSS' | 'DRAW'
export type BotMode = 'demo' | 'mt5'
export type SignalAction = 'BUY' | 'SELL' | 'HOLD'

export interface BotSettings {
  stake: number
  payout: number
  minConfidence: number
  maxConcurrent: number
  dailyLossCap: number
  tradeDurationSec: number
  signalIntervalSec: number
  slPips: number
  tpPips: number
  mt5Lots: number
  mode: BotMode
  metaapiToken: string
  metaapiAccountId: string
  metaapiRegion: string
  botRunning: boolean
  soundEnabled: boolean
  /** rest period (seconds) after a LOSS before the bot may trade again */
  cooldownAfterLossSec: number
  /** pause the bot automatically after N consecutive losses (0 = off) */
  maxConsecutiveLosses: number
  /** symbol currently shown in the UI & targeted by GLM analysis + manual trades */
  activeSymbol: string
  /** auto position sizing: stake = this % of balance (0 = fixed stake) */
  autoStakePct: number
}

export interface Trade {
  id: string
  symbol: string
  direction: Direction
  stake: number
  lots: number
  openPrice: number
  openTime: number
  closeTime: number
  durationSec: number
  status: TradeStatus
  closePrice?: number
  pnl?: number
  result?: TradeResult
  confidence: number
  aiReason: string
  mode: BotMode
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
    /** Kaufman Efficiency Ratio 0..1 — low = choppy market */
    ker: number
  }
  acted: boolean
}

export interface Candle { t: number; o: number; h: number; l: number; c: number }

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
  /** biggest single win in USD */
  bestTrade: number
  /** biggest single loss in USD (negative) */
  worstTrade: number
  /** current streak: +n wins in a row, -n losses in a row */
  streak: number
  bestStreak: number
  /** longest loss streak (negative) */
  worstStreak: number
  grossProfit: number
  /** sum of losing pnl, negative */
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
  candles: Candle[]
  tick: Tick | null
  /** latest tick of every symbol (for the symbol chips) */
  symbolTicks: Record<string, Tick | null>
  mt5: MT5AccountInfo | null
  mt5Status: 'disconnected' | 'connecting' | 'connected' | 'error'
  mt5Error: string | null
}

// ─── Symbol metadata (mirror of engine SYMBOL_CONFIGS) ───
export const SYMBOL_META: Record<string, { fa: string; badge: string; decimals: number }> = {
  XAUUSD: { fa: 'طلا', badge: 'طلا', decimals: 2 },
  BTCUSD: { fa: 'بیت‌کوین', badge: 'BTC', decimals: 1 },
  EURUSD: { fa: 'یورو/دلار', badge: 'EUR', decimals: 5 },
}
export const SYMBOL_LIST = ['XAUUSD', 'BTCUSD', 'EURUSD']
export function symbolFa(symbol: string): string {
  return SYMBOL_META[symbol]?.fa ?? symbol
}
export function fmtPx(symbol: string, price: number): string {
  const d = SYMBOL_META[symbol]?.decimals ?? 2
  return price.toFixed(d)
}
