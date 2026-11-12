// Deterministic unit test for v2 protections using the real engine class.
import { TradingEngine, freshStats } from '../mini-services/trading-engine/engine'

let failed = 0
const expect = (cond: boolean, msg: string) => {
  if (!cond) { failed++; console.error('FAIL:', msg) } else console.log('ok:', msg)
}

const eng: any = new TradingEngine(() => {})

// ── 1. post-loss cooldown blocks AUTO trades but not MANUAL ──
eng.lastLossAt = Date.now()
eng.settings.cooldownAfterLossSec = 60
eng.settings.botRunning = true
const auto = eng.tryOpenTrade('BUY', 90, 'تست')
expect(!auto.ok && auto.reason?.includes('استراحت بعد از باخت'), `auto blocked during cooldown (${auto.reason})`)

const manualCheck = eng.canOpen() // manual path pre-check skips cooldown
expect(manualCheck.ok, 'manual pre-check bypasses cooldown')

// ── 2. cooldown expires ──
eng.lastLossAt = Date.now() - 61_000
const after = eng.tryOpenTrade('BUY', 90, 'تست')
expect(after.ok, 'auto allowed after cooldown expires')
if (after.ok) eng.trades = eng.trades.filter((t: any) => t.id !== after.trade!.id) // cleanup

// ── 3. streak tracking + circuit breaker ──
eng.stats = freshStats()
eng.settings.maxConsecutiveLosses = 3
eng.settings.botRunning = true
eng.pausedReason = null
const mkLoss = (i: number) => ({
  id: `t${i}`, symbol: 'XAUUSD', direction: 'BUY' as const, stake: 10, lots: 0,
  openPrice: 2650, openTime: Date.now(), closeTime: Date.now(), durationSec: 30,
  status: 'closed' as const, pnl: -10, result: 'LOSS' as const, confidence: 70,
  aiReason: 'تست', mode: 'demo' as const, comment: 'test',
})
eng.applyTradeResult(mkLoss(1))
expect(eng.stats.streak === -1 && eng.stats.worstStreak === -1, 'streak -1 after first loss')
expect(eng.stats.grossLoss === -10, 'grossLoss accumulates')
expect(eng.settings.botRunning === true, 'bot still running after 1 loss')
eng.applyTradeResult(mkLoss(2))
expect(eng.stats.streak === -2, 'streak -2 after second loss')
eng.applyTradeResult(mkLoss(3))
expect(eng.stats.streak === -3 && eng.settings.botRunning === false, 'bot auto-paused after 3 consecutive losses')
expect(String(eng.pausedReason).includes('باخت متوالی'), `pause reason recorded (${eng.pausedReason})`)

// ── 4. win after losses resets streak to +1, best/gross tracked ──
eng.stats.streak = -2
eng.stats.bestStreak = 0
eng.applyTradeResult({ ...mkLoss(0), pnl: 18.5, result: 'WIN' })
expect(eng.stats.streak === 1 && eng.stats.bestStreak === 1, 'win after losses resets streak to +1')
expect(eng.stats.bestTrade === 18.5, 'bestTrade tracked')
expect(eng.stats.grossProfit === 18.5, 'grossProfit tracked')

// ── 5. restart clears the pause ──
eng.updateSettings({ botRunning: true })
expect(eng.pausedReason === null, 'restart clears pausedReason')

console.log(failed === 0 ? 'UNIT TESTS PASSED' : `${failed} FAILURES`)
process.exit(failed === 0 ? 0 : 1)
