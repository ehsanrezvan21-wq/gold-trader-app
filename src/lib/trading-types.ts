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
  mt5: MT5AccountInfo | null
  mt5Status: 'disconnected' | 'connecting' | 'connected' | 'error'
  mt5Error: string | null
}
