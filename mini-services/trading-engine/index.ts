// ─── Trading Engine service: HTTP + Socket.io on port 3003 ───
import { createServer } from 'http'
import { Server } from 'socket.io'
import { TradingEngine, DEFAULT_SETTINGS } from './engine'
import type { BotSettings, FullState } from './types'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

const engine = new TradingEngine(() => {
  io.emit('state', engine.snapshot())
})

engine.start()

// broadcast high-frequency tick stream on its own event for smooth UI
setInterval(() => {
  if (engine.tick) io.emit('tick', engine.tick)
}, 1000)

io.on('connection', socket => {
  // full state sync on connect
  socket.emit('state', engine.snapshot())

  socket.on('update-settings', (patch: Partial<BotSettings>) => {
    try {
      const safe: Partial<BotSettings> = {}
      if (patch.stake !== undefined) safe.stake = Math.max(1, Math.min(1000, Number(patch.stake)))
      if (patch.payout !== undefined) safe.payout = Math.max(1, Math.min(10, Number(patch.payout)))
      if (patch.minConfidence !== undefined) safe.minConfidence = Math.max(0, Math.min(100, Number(patch.minConfidence)))
      if (patch.maxConcurrent !== undefined) safe.maxConcurrent = Math.max(1, Math.min(10, Number(patch.maxConcurrent)))
      if (patch.dailyLossCap !== undefined) safe.dailyLossCap = Math.max(5, Math.min(10000, Number(patch.dailyLossCap)))
      if (patch.tradeDurationSec !== undefined) safe.tradeDurationSec = Math.max(15, Math.min(600, Number(patch.tradeDurationSec)))
      if (patch.signalIntervalSec !== undefined) safe.signalIntervalSec = Math.max(5, Math.min(300, Number(patch.signalIntervalSec)))
      if (patch.slPips !== undefined) safe.slPips = Math.max(5, Math.min(500, Number(patch.slPips)))
      if (patch.tpPips !== undefined) safe.tpPips = Math.max(5, Math.min(1000, Number(patch.tpPips)))
      if (patch.mt5Lots !== undefined) safe.mt5Lots = Math.max(0.01, Math.min(10, Number(patch.mt5Lots)))
      if (patch.mode !== undefined) safe.mode = patch.mode === 'mt5' ? 'mt5' : 'demo'
      if (patch.metaapiToken !== undefined) safe.metaapiToken = String(patch.metaapiToken).slice(0, 200)
      if (patch.metaapiAccountId !== undefined) safe.metaapiAccountId = String(patch.metaapiAccountId).slice(0, 100)
      if (patch.metaapiRegion !== undefined) safe.metaapiRegion = String(patch.metaapiRegion).slice(0, 40)
      if (patch.botRunning !== undefined) safe.botRunning = Boolean(patch.botRunning)
      if (patch.soundEnabled !== undefined) safe.soundEnabled = Boolean(patch.soundEnabled)
      if (patch.cooldownAfterLossSec !== undefined) safe.cooldownAfterLossSec = Math.max(0, Math.min(300, Number(patch.cooldownAfterLossSec) || 0))
      if (patch.maxConsecutiveLosses !== undefined) safe.maxConsecutiveLosses = Math.max(0, Math.min(20, Math.round(Number(patch.maxConsecutiveLosses) || 0)))
      engine.updateSettings(safe)
    } catch (e: any) {
      socket.emit('error-msg', e?.message || 'خطا در ذخیره تنظیمات')
    }
  })

  socket.on('manual-trade', (direction: string) => {
    const d = String(direction).toUpperCase() === 'SELL' ? 'SELL' : 'BUY'
    const r = engine.openManualTrade(d)
    if (!r.ok) socket.emit('error-msg', r.reason || 'معامله دستی رد شد')
  })
  socket.on('reset-account', () => engine.resetAccount())
  socket.on('close-trade', (id: string) => engine.closeTradeManually(String(id).slice(0, 40)))
  socket.on('get-state', () => socket.emit('state', engine.snapshot()))
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`Trading engine running on port ${PORT}`)
})

function shutdown() {
  try { engine.stop() } catch {}
  try { httpServer.close() } catch {}
  io.close()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
// never let an async edge (network hiccup, SDK internals) kill the trading loop
process.on('unhandledRejection', (reason: any) => {
  console.error('[unhandledRejection]', reason?.message || reason)
})
process.on('uncaughtException', (err: Error) => {
  console.error('[uncaughtException]', err.message)
})
